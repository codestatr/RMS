import { query } from '../database/db.js'

export const DEFAULT_BRANDING = Object.freeze({
  brandName: process.env.BUSINESS_NAME || 'CozyStay',
  brandColor: '#176b52',
  logo: '',
})

export async function getSystemBranding() {
  const rows = await query(
    `SELECT setting_key, setting_value FROM system_settings
     WHERE setting_key IN ('brand_name', 'brand_color', 'brand_logo')`
  )
  const saved = Object.fromEntries(rows.map(({ setting_key, setting_value }) => [setting_key, setting_value]))
  return {
    brandName: saved.brand_name || DEFAULT_BRANDING.brandName,
    brandColor: /^#[0-9a-f]{6}$/i.test(saved.brand_color || '') ? saved.brand_color : DEFAULT_BRANDING.brandColor,
    logo: saved.brand_logo || '',
  }
}

export async function saveSystemBranding({ brandName, brandColor, logo }) {
  const values = [
    ['brand_name', brandName],
    ['brand_color', brandColor],
    ['brand_logo', logo],
  ]
  for (const [key, value] of values) {
    await query(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    )
  }
  return { brandName, brandColor, logo }
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
