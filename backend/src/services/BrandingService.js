import { query } from '../database/db.js'

export const DEFAULT_BRANDING = Object.freeze({
  brandName: process.env.BUSINESS_NAME || 'CozyStay',
  brandColor: '#176b52',
  logo: '',
  phone: process.env.BUSINESS_PHONE || '+254 700 000000',
  email: process.env.BUSINESS_EMAIL || 'support@rms-rentals.com',
})

export async function getSystemBranding() {
  const rows = await query(
    `SELECT setting_key, setting_value FROM system_settings
     WHERE setting_key IN ('brand_name', 'brand_color', 'brand_logo', 'business_phone', 'business_email')`
  )
  const saved = Object.fromEntries(rows.map(({ setting_key, setting_value }) => [setting_key, setting_value]))
  return {
    brandName: saved.brand_name || DEFAULT_BRANDING.brandName,
    brandColor: /^#[0-9a-f]{6}$/i.test(saved.brand_color || '') ? saved.brand_color : DEFAULT_BRANDING.brandColor,
    logo: saved.brand_logo || '',
    phone: saved.business_phone ?? DEFAULT_BRANDING.phone,
    email: saved.business_email ?? DEFAULT_BRANDING.email,
  }
}

export async function saveSystemBranding({ brandName, brandColor, logo, phone = DEFAULT_BRANDING.phone, email = DEFAULT_BRANDING.email }) {
  const values = [
    ['brand_name', brandName],
    ['brand_color', brandColor],
    ['brand_logo', logo],
    ['business_phone', phone],
    ['business_email', email],
  ]
  for (const [key, value] of values) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    )
  }
  return { brandName, brandColor, logo, phone, email }
}

export async function getHomepageCampaigns() {
  const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['homepage_campaigns'])
  if (!rows.length) return []
  try {
    const campaigns = JSON.parse(rows[0].setting_value)
    return Array.isArray(campaigns) ? campaigns : []
  } catch {
    return []
  }
}

export async function saveHomepageCampaigns(campaigns) {
  await query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    ['homepage_campaigns', JSON.stringify(campaigns)]
  )
  return campaigns
}

export async function getWebsiteAnnouncements() {
  const rows = await query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['website_announcements'])
  if (!rows.length) return []
  try {
    const announcements = JSON.parse(rows[0].setting_value)
    return Array.isArray(announcements) ? announcements : []
  } catch {
    return []
  }
}

export async function saveWebsiteAnnouncements(announcements) {
  await query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    ['website_announcements', JSON.stringify(announcements)]
  )
  return announcements
}
