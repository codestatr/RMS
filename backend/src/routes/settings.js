import express from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'
import { getHomepageCampaigns, getSystemBranding, getWebsiteAnnouncements, saveHomepageCampaigns, saveSystemBranding, saveWebsiteAnnouncements } from '../services/BrandingService.js'

const router = express.Router()
router.get('/branding', asyncHandler(async (_req, res) => {
  const branding = await getSystemBranding()
  res.json({ success: true, data: branding })
}))

router.get('/homepage-campaigns', asyncHandler(async (_req, res) => {
  const campaigns = await getHomepageCampaigns()
  res.json({ success: true, data: campaigns })
}))

router.get('/announcements', asyncHandler(async (_req, res) => {
  const announcements = await getWebsiteAnnouncements()
  res.json({ success: true, data: announcements.filter((announcement) => announcement.active !== false) })
}))

router.put(
  '/announcements',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const announcements = req.body?.announcements
    if (!Array.isArray(announcements) || announcements.length > 5) {
      throw new ValidationError('Announcements must be a list containing no more than 5 messages')
    }
    const normalized = announcements.map((announcement, index) => {
      const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
      const text = cleanText(announcement?.text, 140)
      if (!text) throw new ValidationError(`Announcement ${index + 1} needs message text`)
      const url = cleanText(announcement?.url, 300)
      if (url && (!url.startsWith('/') || url.startsWith('//') || /[\r\n]/.test(url))) {
        throw new ValidationError(`Announcement ${index + 1} link must be a local website path`)
      }
      return {
        id: cleanText(announcement?.id, 80) || `announcement-${index + 1}`,
        text,
        url,
        active: announcement?.active !== false,
      }
    })
    const saved = await saveWebsiteAnnouncements(normalized)
    res.json({ success: true, data: saved })
  })
)

router.put(
  '/homepage-campaigns',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const campaigns = req.body?.campaigns
    if (!Array.isArray(campaigns) || campaigns.length > 5) {
      throw new ValidationError('Campaigns must be a list containing no more than 5 slides')
    }
    let totalImageBytes = 0
    const normalized = campaigns.map((campaign, index) => {
      const image = campaign?.image
      if (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) || image.length > 1_500_000) {
        throw new ValidationError(`Campaign ${index + 1} needs a PNG, JPEG, or WebP image no larger than 1 MB`)
      }
      totalImageBytes += Math.floor((image.length * 3) / 4)
      if (totalImageBytes > 7_500_000) throw new ValidationError('Campaign images are too large to save together')
      const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
      const title = cleanText(campaign.title, 120)
      if (!title) throw new ValidationError(`Campaign ${index + 1} needs a headline`)
      const ctaUrl = cleanText(campaign.ctaUrl, 300)
      if (ctaUrl && (!ctaUrl.startsWith('/') || ctaUrl.startsWith('//') || /[\r\n]/.test(ctaUrl))) {
        throw new ValidationError(`Campaign ${index + 1} link must be a local website path`)
      }
      return {
        id: cleanText(campaign.id, 80) || `campaign-${index + 1}`,
        image,
        eyebrow: cleanText(campaign.eyebrow, 50),
        title,
        description: cleanText(campaign.description, 280),
        ctaLabel: cleanText(campaign.ctaLabel, 30),
        ctaUrl,
        active: campaign.active !== false,
      }
    })
    const saved = await saveHomepageCampaigns(normalized)
    res.json({ success: true, data: saved })
  })
)

router.put(
  '/branding',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const brandColor = String(req.body?.brandColor || '').trim().toLowerCase()
    const brandName = String(req.body?.brandName || '').trim()
    const logo = req.body?.logo ?? ''
    if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      throw new ValidationError('brandColor must be a 6-digit hexadecimal color')
    }
    if (!brandName || brandName.length > 80) {
      throw new ValidationError('brandName must contain between 1 and 80 characters')
    }
    if (typeof logo !== 'string' || logo.length > 1_500_000 || (logo && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(logo))) {
      throw new ValidationError('logo must be a PNG or JPEG image no larger than 1 MB')
    }

    const branding = await saveSystemBranding({ brandColor, brandName, logo })
    res.json({ success: true, data: branding })
  })
)

export default router
