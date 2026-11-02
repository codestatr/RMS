import express from 'express'
import { query } from '../database/db.js'
import BookingService from '../services/BookingService.js'
import PropertyService from '../services/PropertyService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'

const router = express.Router()
router.use(authenticate, requireRole('property_owner'))

async function getOwnedProperty(propertyId, ownerId) {
  const rows = await query('SELECT id FROM properties WHERE id = ? AND owner_id = ?', [propertyId, ownerId])
  if (!rows.length) throw new ValidationError('Property not found in your owner account')
  return rows[0]
}

router.get('/overview', asyncHandler(async (req, res) => {
  const ownerId = req.user.id
  const [properties, stats, bookings, services, payments, reviews] = await Promise.all([
    query(`SELECT p.id, p.name, p.type, p.description, p.address, p.city, p.country,
                  p.status, p.price_per_night, p.price_per_week, p.price_per_month,
                  p.capacity, p.bedrooms, p.bathrooms, p.housekeeping_status,
                  (SELECT image_url FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.is_cover DESC, pi.display_order LIMIT 1) AS image_url,
                  (SELECT AVG(r.rating) FROM reviews r WHERE r.property_id = p.id AND r.status = 'approved') AS average_rating,
                  (SELECT COUNT(*) FROM reviews r WHERE r.property_id = p.id) AS review_count
           FROM properties p WHERE p.owner_id = ? ORDER BY p.created_at DESC`, [ownerId]),
    query(`SELECT COUNT(DISTINCT p.id) AS property_count,
                  COUNT(DISTINCT CASE WHEN b.status IN ('confirmed', 'checked_in') THEN b.id END) AS active_stays,
                  COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) AS pending_bookings,
                  COALESCE(SUM(CASE WHEN pay.status = 'paid' AND pay.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN pay.amount ELSE 0 END), 0) AS monthly_revenue
           FROM properties p
           LEFT JOIN bookings b ON b.property_id = p.id
           LEFT JOIN payments pay ON pay.booking_id = b.id
           WHERE p.owner_id = ?`, [ownerId]),
    query(`SELECT b.id, b.check_in_date, b.check_out_date, b.number_of_guests, b.total_amount, b.status,
                  b.special_requests, b.arrival_window, p.id AS property_id, p.name AS property_name,
                  u.first_name, u.last_name, u.email, u.phone
           FROM bookings b JOIN properties p ON p.id = b.property_id
           JOIN users u ON u.id = b.customer_id
           WHERE p.owner_id = ? ORDER BY b.check_in_date DESC, b.created_at DESC LIMIT 100`, [ownerId]),
    query(`SELECT ba.id, ba.booking_id, ba.quantity, ba.unit_price, ba.status, ba.fulfillment_status, ba.created_at,
                  sa.name AS service_name, p.id AS property_id, p.name AS property_name,
                  b.check_in_date, b.check_out_date, u.first_name, u.last_name, u.phone
           FROM booking_addons ba JOIN service_addons sa ON sa.id = ba.addon_id
           JOIN bookings b ON b.id = ba.booking_id JOIN properties p ON p.id = b.property_id
           JOIN users u ON u.id = b.customer_id
           WHERE p.owner_id = ? ORDER BY FIELD(ba.status, 'pending', 'approved', 'fulfilled', 'declined'), ba.created_at DESC LIMIT 100`, [ownerId]),
    query(`SELECT pay.id, pay.booking_id, pay.amount, pay.method, pay.status, pay.transaction_ref, pay.created_at,
                  b.check_in_date, b.check_out_date, p.name AS property_name
           FROM payments pay JOIN bookings b ON b.id = pay.booking_id
           JOIN properties p ON p.id = b.property_id
           WHERE p.owner_id = ? ORDER BY pay.created_at DESC LIMIT 100`, [ownerId]),
    query(`SELECT r.id, r.property_id, r.rating, r.title, r.comment, r.status, r.created_at,
                  p.name AS property_name, u.first_name, u.last_name
           FROM reviews r JOIN properties p ON p.id = r.property_id
           JOIN users u ON u.id = r.customer_id
           WHERE p.owner_id = ? ORDER BY r.created_at DESC LIMIT 100`, [ownerId]),
  ])

  const monthlyRevenue = await query(`SELECT DATE_FORMAT(pay.created_at, '%Y-%m') AS month,
      COALESCE(SUM(pay.amount), 0) AS revenue, COUNT(*) AS payment_count
    FROM payments pay JOIN bookings b ON b.id = pay.booking_id
    JOIN properties p ON p.id = b.property_id
    WHERE p.owner_id = ? AND pay.status = 'paid' AND pay.created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
    GROUP BY DATE_FORMAT(pay.created_at, '%Y-%m') ORDER BY month`, [ownerId])

  res.json({ success: true, data: { properties, stats: stats[0], bookings, services, payments, reviews, monthlyRevenue } })
}))

router.post('/properties', asyncHandler(async (req, res) => {
  const property = await PropertyService.createProperty(req.user.id, req.body || {})
  res.status(201).json({ success: true, message: 'Property created', data: property })
}))

router.put('/properties/:id', asyncHandler(async (req, res) => {
  const property = await PropertyService.updateProperty(req.params.id, req.user.id, req.body || {})
  res.json({ success: true, message: 'Property updated', data: property })
}))

router.patch('/properties/:id/housekeeping', asyncHandler(async (req, res) => {
  await getOwnedProperty(req.params.id, req.user.id)
  const { housekeepingStatus } = req.body || {}
  if (!['clean', 'dirty', 'maintenance'].includes(housekeepingStatus)) {
    throw new ValidationError('Housekeeping status must be clean, dirty, or maintenance')
  }
  await query('UPDATE properties SET housekeeping_status = ?, updated_at = NOW() WHERE id = ? AND owner_id = ?',
    [housekeepingStatus, req.params.id, req.user.id])
  res.json({ success: true, message: 'Room readiness updated', data: { propertyId: req.params.id, housekeepingStatus } })
}))

router.patch('/bookings/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  if (!['confirmed', 'cancelled'].includes(status)) {
    throw new ValidationError('Owners can confirm or cancel reservations')
  }
  const bookings = await query(`SELECT b.id FROM bookings b JOIN properties p ON p.id = b.property_id
    WHERE b.id = ? AND p.owner_id = ?`, [req.params.id, req.user.id])
  if (!bookings.length) throw new ValidationError('Reservation not found in your properties')
  const booking = await BookingService.updateBookingStatus(req.params.id, status, req.user.id, req.user.role)
  res.json({ success: true, message: `Reservation ${status}`, data: booking })
}))

router.patch('/room-service/:id', asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  if (!['approved', 'declined', 'fulfilled'].includes(status)) {
    throw new ValidationError('Status must be approved, declined, or fulfilled')
  }
  const owned = await query(`SELECT ba.id FROM booking_addons ba
    JOIN bookings b ON b.id = ba.booking_id JOIN properties p ON p.id = b.property_id
    WHERE ba.id = ? AND p.owner_id = ?`, [req.params.id, req.user.id])
  if (!owned.length) throw new ValidationError('Room service request not found for your properties')

  await BookingService.updateServiceRequest(req.params.id, status, req.user.id)
  const [updated] = await query('SELECT id, status, fulfillment_status FROM booking_addons WHERE id = ?', [req.params.id])
  res.json({ success: true, message: 'Room service request updated', data: updated })
}))

export default router
