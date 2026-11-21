import express from 'express'
import { query } from '../database/db.js'
import BookingService from '../services/BookingService.js'
import PropertyService from '../services/PropertyService.js'
import HousekeepingService from '../services/HousekeepingService.js'
import UserService from '../services/UserService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'

const router = express.Router()
router.use(authenticate, requireRole('property_owner'))

const OWNER_TEAM_ROLES = ['property_owner', 'admin', 'cashier', 'housekeeping', 'catering']

async function getOwnedProperty(propertyId) {
  const rows = await query('SELECT id FROM properties WHERE id = ?', [propertyId])
  if (!rows.length) throw new ValidationError('Property not found')
  return rows[0]
}

async function validatePropertyIds(propertyIds, required = true) {
  const ids = [...new Set((Array.isArray(propertyIds) ? propertyIds : []).map((id) => String(id)))]
  if (!ids.length) {
    if (required) throw new ValidationError('Assign the staff member to at least one property')
    return []
  }
  const owned = await query(`SELECT id FROM properties WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
  if (owned.length !== ids.length) throw new ValidationError('One or more selected properties do not exist')
  return ids
}

router.get('/team', asyncHandler(async (_req, res) => {
  const assignments = await query(`SELECT u.id AS staff_id, a.owner_id, a.status AS assignment_status,
      a.created_at AS assigned_at, u.email, u.first_name, u.last_name, u.phone, u.role,
      u.status AS account_status, u.last_login
    FROM users u LEFT JOIN owner_staff_assignments a ON a.staff_id = u.id
    WHERE u.role IN ('admin', 'cashier', 'property_owner', 'housekeeping', 'catering')
    ORDER BY u.first_name, u.last_name`)
  const properties = await query(`SELECT sp.staff_id, p.id, p.name FROM owner_staff_properties sp
    JOIN properties p ON p.id = sp.property_id ORDER BY p.name`)
  const propertiesByStaff = new Map()
  for (const property of properties) {
    const assigned = propertiesByStaff.get(property.staff_id) || []
    assigned.push({ id: property.id, name: property.name })
    propertiesByStaff.set(property.staff_id, assigned)
  }
  res.json({ success: true, data: assignments.map((member) => ({
    id: member.staff_id,
    ownerId: member.owner_id,
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    phone: member.phone,
    role: member.role,
    status: member.account_status === 'active' && member.assignment_status !== 'inactive' ? 'active' : 'inactive',
    lastLogin: member.last_login,
    createdAt: member.assigned_at,
    properties: propertiesByStaff.get(member.staff_id) || [],
  })) })
}))

router.post('/team', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, role } = req.body || {}
  if (!OWNER_TEAM_ROLES.includes(role)) {
    throw new ValidationError('Choose administrator, cashier, housekeeping, or catering access')
  }
  const propertyIds = await validatePropertyIds(req.body?.propertyIds, !['admin', 'property_owner'].includes(role))
  const created = await UserService.register({
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    phone: String(phone || '').trim(),
    password,
    role,
  })

  try {
    await query('INSERT INTO owner_staff_assignments (owner_id, staff_id, status) VALUES (?, ?, \'active\')', [req.user.id, created.id])
    for (const propertyId of propertyIds) {
      await query('INSERT INTO owner_staff_properties (owner_id, staff_id, property_id) VALUES (?, ?, ?)', [req.user.id, created.id, propertyId])
    }
  } catch (error) {
    await query('DELETE FROM users WHERE id = ?', [created.id]).catch(() => {})
    throw error
  }

  res.status(201).json({ success: true, message: 'System account created', data: created })
}))

router.patch('/team/:staffId', asyncHandler(async (req, res) => {
  const [member] = await query(`SELECT a.staff_id, a.owner_id, u.status AS account_status, u.role
    FROM users u LEFT JOIN owner_staff_assignments a ON a.staff_id = u.id
    WHERE u.id = ? AND u.role <> 'customer'`, [req.params.staffId])
  if (!member) throw new ValidationError('System staff member not found')
  const assignmentOwnerId = member.owner_id || req.user.id

  const updates = req.body || {}
  if (updates.status !== undefined && !['active', 'inactive'].includes(updates.status)) {
    throw new ValidationError('Team status must be active or inactive')
  }
  if (updates.role !== undefined && !OWNER_TEAM_ROLES.includes(updates.role)) {
    throw new ValidationError('Choose administrator, cashier, housekeeping, or catering access')
  }
  let propertyIds
  const nextRole = updates.role || member.role
  if (updates.propertyIds !== undefined) propertyIds = await validatePropertyIds(updates.propertyIds, !['admin', 'property_owner'].includes(nextRole))
  else if (updates.role && !['admin', 'property_owner'].includes(nextRole)) {
    const currentProperties = await query('SELECT property_id FROM owner_staff_properties WHERE owner_id = ? AND staff_id = ?', [assignmentOwnerId, req.params.staffId])
    if (!currentProperties.length) throw new ValidationError('Assign at least one property before switching this account to a staff role')
  }

  if (updates.status !== undefined) {
    await query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [updates.status === 'active' ? 'active' : 'inactive', req.params.staffId])
    if (member.owner_id) await query('UPDATE owner_staff_assignments SET status = ? WHERE owner_id = ? AND staff_id = ?', [updates.status, assignmentOwnerId, req.params.staffId])
  }
  if (updates.role !== undefined) {
    await query('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [updates.role, req.params.staffId])
  }
  if (propertyIds) {
    if (!member.owner_id) await query('INSERT INTO owner_staff_assignments (owner_id, staff_id, status) VALUES (?, ?, ?)', [assignmentOwnerId, req.params.staffId, member.account_status === 'active' ? 'active' : 'inactive'])
    await query('DELETE FROM owner_staff_properties WHERE owner_id = ? AND staff_id = ?', [assignmentOwnerId, req.params.staffId])
    for (const propertyId of propertyIds) {
      await query('INSERT INTO owner_staff_properties (owner_id, staff_id, property_id) VALUES (?, ?, ?)', [assignmentOwnerId, req.params.staffId, propertyId])
    }
  }
  res.json({ success: true, message: 'Team access updated' })
}))

router.get('/activity', asyncHandler(async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10)
  const limit = Math.min(Math.max(requestedLimit || 50, 1), 100)
  const events = await query(`SELECT e.id, e.action, e.entity_type, e.entity_id, e.created_at,
      u.first_name, u.last_name, u.email, u.role AS actor_role, p.name AS property_name
    FROM owner_activity_events e
    LEFT JOIN users u ON u.id = e.actor_id
    LEFT JOIN properties p ON p.id = e.property_id
    ORDER BY e.created_at DESC LIMIT ?`, [limit])
  res.json({ success: true, data: events.map((event) => ({
    ...event,
    actorName: `${event.first_name || ''} ${event.last_name || ''}`.trim() || event.email || 'Former team member',
  })) })
}))

router.get('/analytics', asyncHandler(async (_req, res) => {
  const [accounts, bookingStatuses, cashierSummary, openShifts, shifts, housekeeping, catering, recentEvents, cashierEvents] = await Promise.all([
    query(`SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status ORDER BY role, status`),
    query(`SELECT status, COUNT(*) AS count FROM bookings GROUP BY status ORDER BY status`),
    query(`SELECT COUNT(*) AS transaction_count,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount
      FROM payments WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`),
    query(`SELECT COUNT(*) AS count FROM shifts WHERE status = 'open'`),
    query(`SELECT s.id, s.open_time, s.close_time, s.status, s.opening_balance,
        s.expected_closing_balance, s.actual_closing_balance,
        u.first_name AS cashier_first_name, u.last_name AS cashier_last_name, u.email AS cashier_email,
        COUNT(CASE WHEN p.status = 'paid' THEN p.id END) AS transaction_count,
        COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS amount_collected
      FROM shifts s JOIN users u ON u.id = s.cashier_id
      LEFT JOIN payments p ON p.issued_by = s.cashier_id AND p.created_at >= s.open_time
        AND (s.close_time IS NULL OR p.created_at <= s.close_time)
      GROUP BY s.id, s.open_time, s.close_time, s.status, s.opening_balance,
        s.expected_closing_balance, s.actual_closing_balance, u.first_name, u.last_name, u.email
      ORDER BY s.open_time DESC LIMIT 20`),
    query(`SELECT status, COUNT(*) AS count FROM housekeeping_tasks GROUP BY status ORDER BY status`),
    query(`SELECT status, COUNT(*) AS count FROM guest_service_requests
      WHERE service_type IN ('food', 'refreshments') GROUP BY status ORDER BY status`),
    query(`SELECT e.id, e.action, e.created_at, u.first_name, u.last_name, u.email,
        u.role AS actor_role, p.name AS property_name
      FROM owner_activity_events e LEFT JOIN users u ON u.id = e.actor_id
      LEFT JOIN properties p ON p.id = e.property_id ORDER BY e.created_at DESC LIMIT 12`),
    query(`SELECT e.id, e.action, e.created_at, u.first_name, u.last_name, u.email,
        u.role AS actor_role, p.name AS property_name
      FROM owner_activity_events e JOIN users u ON u.id = e.actor_id
      LEFT JOIN properties p ON p.id = e.property_id
      WHERE u.role = 'cashier' ORDER BY e.created_at DESC LIMIT 50`),
  ])
  const accountCounts = accounts.reduce((result, row) => {
    result[row.role] ||= { active: 0, inactive: 0, suspended: 0, total: 0 }
    result[row.role][row.status] = Number(row.count)
    result[row.role].total += Number(row.count)
    return result
  }, {})
  const statusCounts = (rows) => Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]))
  res.json({ success: true, data: {
    accounts: accountCounts,
    bookings: statusCounts(bookingStatuses),
    cashier: { transactionsToday: Number(cashierSummary[0]?.transaction_count || 0), paidToday: Number(cashierSummary[0]?.paid_amount || 0), openShifts: Number(openShifts[0]?.count || 0) },
    shifts: shifts.map((shift) => ({
      ...shift,
      cashierName: `${shift.cashier_first_name || ''} ${shift.cashier_last_name || ''}`.trim() || shift.cashier_email || 'Cashier',
      transaction_count: Number(shift.transaction_count || 0),
      amount_collected: Number(shift.amount_collected || 0),
    })),
    housekeeping: statusCounts(housekeeping),
    catering: statusCounts(catering),
    recentActivity: recentEvents.map((event) => ({
      ...event,
      actorName: `${event.first_name || ''} ${event.last_name || ''}`.trim() || event.email || 'Former account',
    })),
    cashierActivity: cashierEvents.map((event) => ({
      ...event,
      actorName: `${event.first_name || ''} ${event.last_name || ''}`.trim() || event.email || 'Former cashier',
    })),
    updatedAt: new Date().toISOString(),
  } })
}))

router.get('/overview', asyncHandler(async (_req, res) => {
  const [properties, stats, bookings, services, payments, reviews, propertyImageRows] = await Promise.all([
    query(`SELECT p.id, p.name, p.type, p.description, p.address, p.city, p.country,
                  p.status, p.price_per_night, p.price_per_week, p.price_per_month,
                  p.capacity, p.bedrooms, p.bathrooms, p.housekeeping_status,
                  (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.is_cover DESC, pi.display_order LIMIT 1) AS image_url,
                  (SELECT AVG(r.rating) FROM reviews r WHERE r.property_id = p.id AND r.status = 'approved') AS average_rating,
                  (SELECT COUNT(*) FROM reviews r WHERE r.property_id = p.id) AS review_count
           FROM properties p ORDER BY p.created_at DESC`),
    query(`SELECT COUNT(DISTINCT p.id) AS property_count,
                  COUNT(DISTINCT CASE WHEN b.status IN ('confirmed', 'checked_in') THEN b.id END) AS active_stays,
                  COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) AS pending_bookings,
                  COALESCE(SUM(CASE WHEN pay.status = 'paid' AND pay.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN pay.amount ELSE 0 END), 0) AS monthly_revenue
           FROM properties p
           LEFT JOIN bookings b ON b.property_id = p.id
           LEFT JOIN payments pay ON pay.booking_id = b.id
           WHERE p.id IS NOT NULL`),
    query(`SELECT b.id, b.check_in_date, b.check_out_date, b.number_of_guests, b.total_amount, b.status,
                  b.special_requests, b.arrival_window, p.id AS property_id, p.name AS property_name,
                  CASE WHEN u.role = 'customer' THEN u.first_name ELSE 'Guest details unavailable' END AS first_name,
                  CASE WHEN u.role = 'customer' THEN u.last_name ELSE '' END AS last_name,
                  CASE WHEN u.role = 'customer' THEN u.email ELSE NULL END AS email,
                  CASE WHEN u.role = 'customer' THEN u.phone ELSE NULL END AS phone
           FROM bookings b JOIN properties p ON p.id = b.property_id
           JOIN users u ON u.id = b.customer_id
           ORDER BY b.check_in_date DESC, b.created_at DESC LIMIT 100`),
    query(`SELECT ba.id, ba.booking_id, ba.quantity, ba.unit_price, ba.status, ba.fulfillment_status, ba.created_at,
                  sa.name AS service_name, p.id AS property_id, p.name AS property_name,
                  b.check_in_date, b.check_out_date, u.first_name, u.last_name, u.phone
           FROM booking_addons ba JOIN service_addons sa ON sa.id = ba.addon_id
           JOIN bookings b ON b.id = ba.booking_id JOIN properties p ON p.id = b.property_id
           JOIN users u ON u.id = b.customer_id
           ORDER BY FIELD(ba.status, 'pending', 'approved', 'fulfilled', 'declined'), ba.created_at DESC LIMIT 100`),
    query(`SELECT pay.id, pay.booking_id, pay.amount, pay.method, pay.status, pay.transaction_ref, pay.created_at,
                  b.check_in_date, b.check_out_date, p.name AS property_name
           FROM payments pay JOIN bookings b ON b.id = pay.booking_id
           JOIN properties p ON p.id = b.property_id
           ORDER BY pay.created_at DESC LIMIT 100`),
    query(`SELECT r.id, r.property_id, r.rating, r.title, r.comment, r.status, r.created_at,
                  p.name AS property_name, u.first_name, u.last_name
           FROM reviews r JOIN properties p ON p.id = r.property_id
           JOIN users u ON u.id = r.customer_id
           ORDER BY r.created_at DESC LIMIT 100`),
    query(`SELECT pi.property_id, pi.image_url FROM property_images pi
           JOIN properties p ON p.id = pi.property_id
           ORDER BY pi.property_id, pi.is_cover DESC, pi.display_order`),
  ])

  const imagesByProperty = new Map()
  for (const image of propertyImageRows) {
    const images = imagesByProperty.get(image.property_id) || []
    images.push(image.image_url)
    imagesByProperty.set(image.property_id, images)
  }
  const propertiesWithImages = properties.map((property) => ({
    ...property,
    images: imagesByProperty.get(property.id) || (property.image_url ? [property.image_url] : []),
  }))

  const monthlyRevenue = await query(`SELECT DATE_FORMAT(pay.created_at, '%Y-%m') AS month,
      COALESCE(SUM(pay.amount), 0) AS revenue, COUNT(*) AS payment_count
    FROM payments pay JOIN bookings b ON b.id = pay.booking_id
    JOIN properties p ON p.id = b.property_id
    WHERE pay.status = 'paid' AND pay.created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
    GROUP BY DATE_FORMAT(pay.created_at, '%Y-%m') ORDER BY month`)

  res.json({ success: true, data: { properties: propertiesWithImages, stats: stats[0], bookings, services, payments, reviews, monthlyRevenue } })
}))

router.post('/properties', asyncHandler(async (req, res) => {
  const property = await PropertyService.createProperty(req.user.id, req.body || {})
  res.status(201).json({ success: true, message: 'Property created', data: property })
}))

router.put('/properties/:id', asyncHandler(async (req, res) => {
  const property = await PropertyService.updateProperty(req.params.id, req.user.id, req.body || {}, true)
  res.json({ success: true, message: 'Property updated', data: property })
}))

router.patch('/properties/:id/housekeeping', asyncHandler(async (req, res) => {
  await getOwnedProperty(req.params.id)
  const { housekeepingStatus } = req.body || {}
  if (!['clean', 'dirty', 'maintenance'].includes(housekeepingStatus)) {
    throw new ValidationError('Housekeeping status must be clean, dirty, or maintenance')
  }
  const result = await HousekeepingService.updatePropertyStatus(req.params.id, housekeepingStatus, req.user)
  res.json({ success: true, message: 'Room readiness updated', data: result })
}))

router.patch('/bookings/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  if (!['confirmed', 'cancelled'].includes(status)) {
    throw new ValidationError('Owners can confirm or cancel reservations')
  }
  const bookings = await query('SELECT id FROM bookings WHERE id = ?', [req.params.id])
  if (!bookings.length) throw new ValidationError('Reservation not found')
  const booking = await BookingService.updateBookingStatus(req.params.id, status, req.user.id, req.user.role)
  res.json({ success: true, message: `Reservation ${status}`, data: booking })
}))

router.patch('/room-service/:id', asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  if (!['approved', 'declined', 'fulfilled'].includes(status)) {
    throw new ValidationError('Status must be approved, declined, or fulfilled')
  }
  const owned = await query('SELECT id FROM booking_addons WHERE id = ?', [req.params.id])
  if (!owned.length) throw new ValidationError('Room service request not found')

  await BookingService.updateServiceRequest(req.params.id, status, req.user.id)
  const [updated] = await query('SELECT id, status, fulfillment_status FROM booking_addons WHERE id = ?', [req.params.id])
  res.json({ success: true, message: 'Room service request updated', data: updated })
}))

export default router
