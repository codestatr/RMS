import { v4 as uuidv4 } from 'uuid'
import { query } from '../database/db.js'
import NotificationService from './NotificationService.js'
import { getSystemBranding } from './BrandingService.js'
import { ValidationError } from '../utils/errors.js'

const DEFAULTS = {
  enabled: true,
  bookingConfirmation: {
    enabled: true,
    subject: 'Your booking at {{businessName}} is confirmed',
    body: 'Hello {{guestName}},\n\nYour stay at {{propertyName}} is confirmed.\nCheck-in: {{checkInDate}}\nCheck-out: {{checkOutDate}}\nTotal: KES {{totalAmount}}\n\nWe look forward to welcoming you.\n{{businessName}}',
  },
  arrivalReminder: {
    enabled: true,
    subject: 'Your stay at {{propertyName}} starts tomorrow',
    body: 'Hello {{guestName}},\n\nWe look forward to welcoming you tomorrow at {{propertyName}}.\nCheck-in: {{checkInDate}}\nCheck-out: {{checkOutDate}}\n\nFor help, contact us at {{supportPhone}} or {{supportEmail}}.\n{{businessName}}',
  },
  paymentReminder: {
    enabled: true,
    subject: 'Payment reminder for your stay at {{propertyName}}',
    body: 'Hello {{guestName}},\n\nThere is an outstanding balance of KES {{balance}} for your booking at {{propertyName}}. Your check-in date is {{checkInDate}}.\n\nPlease contact {{businessName}} at {{supportPhone}} or {{supportEmail}} if you have already paid or need assistance.',
  },
  checkoutReminder: {
    enabled: true,
    subject: 'Checkout today at {{propertyName}}',
    body: 'Hello {{guestName}},\n\nA reminder that checkout for {{propertyName}} is today, {{checkOutDate}}. Please contact {{businessName}} at {{supportPhone}} if you need assistance.\n\nThank you for staying with us.',
  },
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

function mergeSettings(saved = {}) {
  return {
    enabled: saved.enabled !== false,
    ...Object.fromEntries(Object.entries(DEFAULTS).filter(([key]) => key !== 'enabled').map(([key, defaults]) => [
      key,
      { ...defaults, ...(saved[key] || {}), enabled: saved[key]?.enabled !== false },
    ])),
  }
}

export async function getGuestMessagingSettings() {
  const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['guest_messaging'])
  if (!rows.length) return DEFAULTS
  try { return mergeSettings(JSON.parse(rows[0].setting_value)) } catch { return DEFAULTS }
}

export async function saveGuestMessagingSettings(input) {
  const normalized = mergeSettings(input)
  const cleanText = (value, max) => String(value || '').trim().slice(0, max)
  for (const key of ['bookingConfirmation', 'arrivalReminder', 'paymentReminder', 'checkoutReminder']) {
    normalized[key] = {
      enabled: input?.[key]?.enabled !== false,
      subject: cleanText(input?.[key]?.subject ?? DEFAULTS[key].subject, 160),
      body: cleanText(input?.[key]?.body ?? DEFAULTS[key].body, 4000),
    }
    if (!normalized[key].subject || !normalized[key].body) throw new ValidationError(`${key} needs both a subject and message`)
  }
  normalized.enabled = input?.enabled !== false
  await query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES ('guest_messaging', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [JSON.stringify(normalized)]
  )
  return normalized
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(date)
}

function render(template, values) {
  const replace = (text) => String(text || '').replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_match, key) => String(values[key] ?? ''))
  return { subject: replace(template.subject).replace(/[\r\n]+/g, ' '), html: replace(template.body).split(/\r?\n/).map(escapeHtml).join('<br>') }
}

async function sendTemplatedEmail(booking, template, extraValues = {}) {
  const email = booking.email || booking.customerEmail
  if (!email) return false
  const branding = await getSystemBranding()
  const guestName = booking.guestName || `${booking.first_name || booking.firstName || ''} ${booking.last_name || booking.lastName || ''}`.trim() || 'Guest'
  const values = {
    businessName: branding.brandName, guestName,
    propertyName: booking.property_name || booking.propertyName, checkInDate: formatDate(booking.check_in_date || booking.checkInDate),
    checkOutDate: formatDate(booking.check_out_date || booking.checkOutDate), totalAmount: Number(booking.total_amount || booking.totalAmount || 0).toLocaleString('en-KE'),
    supportPhone: branding.phone, supportEmail: branding.email,
    ...extraValues,
  }
  const content = render(template, values)
  return NotificationService.sendEmail(email, content.subject, content.html, branding.brandName)
}

export async function sendBookingConfirmation(booking) {
  const settings = await getGuestMessagingSettings()
  if (!settings.enabled || !settings.bookingConfirmation.enabled || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false
  return sendTemplatedEmail(booking, settings.bookingConfirmation)
}

async function claimMessage(bookingId, messageType) {
  const id = uuidv4()
  const inserted = await query(
    `INSERT IGNORE INTO guest_message_log (id, booking_id, message_type, status)
     VALUES (?, ?, ?, 'sending')`, [id, bookingId, messageType]
  )
  if (inserted.affectedRows) return true
  const retried = await query(
    `UPDATE guest_message_log SET status = 'sending', last_error = NULL, updated_at = NOW()
     WHERE booking_id = ? AND message_type = ? AND status = 'failed'`, [bookingId, messageType]
  )
  return Boolean(retried.affectedRows)
}

async function deliverReminder(booking, messageType, template, extraValues = {}) {
  if (!await claimMessage(booking.id, messageType)) return
  try {
    const sent = await sendTemplatedEmail(booking, template, extraValues)
    await query(
      `UPDATE guest_message_log SET status = ?, last_error = ?, updated_at = NOW()
       WHERE booking_id = ? AND message_type = ?`,
      [sent ? 'sent' : 'failed', sent ? null : 'Email delivery failed; check the SMTP configuration.', booking.id, messageType]
    )
  } catch (error) {
    await query(
      `UPDATE guest_message_log SET status = 'failed', last_error = ?, updated_at = NOW()
       WHERE booking_id = ? AND message_type = ?`,
      [String(error.message || 'Email delivery failed').slice(0, 500), booking.id, messageType]
    )
  }
}

export async function processDueGuestMessages() {
  const settings = await getGuestMessagingSettings()
  if (!settings.enabled || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return

  await query(`UPDATE guest_message_log SET status = 'failed', last_error = 'Previous delivery attempt timed out', updated_at = NOW()
    WHERE status = 'sending' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`)

  const [arrivals, paymentDue, checkouts] = await Promise.all([
    settings.arrivalReminder.enabled ? query(
      `SELECT b.id, b.total_amount, b.check_in_date, b.check_out_date, p.name AS property_name, u.first_name, u.last_name, u.email
       FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users u ON u.id = b.customer_id
       LEFT JOIN guest_message_log g ON g.booking_id = b.id AND g.message_type = 'arrival_reminder' AND g.status = 'sent'
       WHERE DATE(b.check_in_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND b.status = 'confirmed'
         AND u.email IS NOT NULL AND u.email <> '' AND g.id IS NULL LIMIT 100`
    ) : Promise.resolve([]),
    settings.paymentReminder.enabled ? query(
      `SELECT b.id, b.total_amount, b.check_in_date, b.check_out_date, p.name AS property_name, u.first_name, u.last_name, u.email,
              GREATEST(b.total_amount - COALESCE(SUM(CASE WHEN pay.status = 'paid' THEN pay.amount ELSE 0 END), 0), 0) AS balance
       FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users u ON u.id = b.customer_id
       LEFT JOIN payments pay ON pay.booking_id = b.id
       LEFT JOIN guest_message_log g ON g.booking_id = b.id AND g.message_type = 'payment_reminder' AND g.status = 'sent'
       WHERE DATE(b.check_in_date) = DATE_ADD(CURDATE(), INTERVAL 2 DAY) AND b.status = 'confirmed'
         AND u.email IS NOT NULL AND u.email <> '' AND g.id IS NULL
       GROUP BY b.id, b.total_amount, b.check_in_date, b.check_out_date, p.name, u.first_name, u.last_name, u.email
       HAVING balance > 0 LIMIT 100`
    ) : Promise.resolve([]),
    settings.checkoutReminder.enabled ? query(
      `SELECT b.id, b.total_amount, b.check_in_date, b.check_out_date, p.name AS property_name, u.first_name, u.last_name, u.email
       FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users u ON u.id = b.customer_id
       LEFT JOIN guest_message_log g ON g.booking_id = b.id AND g.message_type = 'checkout_reminder' AND g.status = 'sent'
       WHERE DATE(b.check_out_date) = CURDATE() AND b.status = 'checked_in' AND HOUR(NOW()) >= 8
         AND u.email IS NOT NULL AND u.email <> '' AND g.id IS NULL LIMIT 100`
    ) : Promise.resolve([]),
  ])

  for (const booking of arrivals) await deliverReminder(booking, 'arrival_reminder', settings.arrivalReminder)
  for (const booking of paymentDue) await deliverReminder(booking, 'payment_reminder', settings.paymentReminder, { balance: Number(booking.balance || 0).toLocaleString('en-KE') })
  for (const booking of checkouts) await deliverReminder(booking, 'checkout_reminder', settings.checkoutReminder)
}

export default { getGuestMessagingSettings, saveGuestMessagingSettings, sendBookingConfirmation, processDueGuestMessages }
