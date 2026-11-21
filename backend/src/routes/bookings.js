import express from 'express'
import BookingService from '../services/BookingService.js'
import { authenticate, requireRole, optionalAuthenticate } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'
import { query } from '../database/db.js'

const router = express.Router()

/**
 * GET /api/bookings
 * Get all bookings (filtered by user/admin role)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query

    let result

    if (['admin', 'cashier', 'property_owner', 'housekeeping', 'catering'].includes(req.user.role)) {
      // Staff need the shared booking board for front-desk operations.
      result = await BookingService.getAllBookings({ status, propertyIds: req.user.ownerScopedStaff ? req.user.propertyIds : null }, page, limit)
    } else {
      // Customers see only their bookings
      result = await BookingService.getCustomerBookings(req.user.id, status, page, limit)
    }

    res.json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: result,
    })
  })
)

/**
 * POST /api/bookings
 * Create a new booking
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const isWalkIn = ['admin', 'cashier', 'property_owner'].includes(req.user.role) && req.body?.source === 'pos'
    if (req.user.ownerScopedStaff && !req.user.propertyIds.includes(req.body?.propertyId)) throw new ValidationError('Property is outside your assigned access')
    const customerId = isWalkIn
      ? await BookingService.resolveWalkInCustomer({ name: req.body.guestName, phone: req.body.guestPhone })
      : req.user.id
    const result = await BookingService.createBooking(customerId, req.body, isWalkIn ? 'pos' : 'website')

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: result,
    })
  })
)

router.get(
  '/addons',
  optionalAuthenticate,
  asyncHandler(async (_req, res) => {
    const result = await BookingService.getAvailableAddons()
    res.json({ success: true, data: result })
  })
)

router.get(
  '/service-requests',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const result = await BookingService.getServiceRequests(req.query.status || null, req.user.ownerScopedStaff ? req.user.propertyIds : null)
    res.json({ success: true, data: result })
  })
)

router.patch(
  '/service-requests/:id',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    if (req.user.ownerScopedStaff) {
      const [service] = await query(`SELECT b.property_id FROM booking_addons ba JOIN bookings b ON b.id = ba.booking_id WHERE ba.id = ?`, [req.params.id])
      if (!service || !req.user.propertyIds.includes(service.property_id)) throw new ValidationError('Service request is outside your assigned properties')
    }
    const result = await BookingService.updateServiceRequest(
      req.params.id,
      req.body?.status,
      req.user.id,
      req.body?.fulfillmentStatus,
      req.body?.assignedTo
    )
    res.json({ success: true, message: 'Service request updated', data: result })
  })
)

/**
 * GET /api/bookings/:id
 * Get booking details
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.ownerScopedStaff) {
      const [booking] = await query('SELECT property_id FROM bookings WHERE id = ?', [req.params.id])
      if (!booking || !req.user.propertyIds.includes(booking.property_id)) throw new ValidationError('Booking is outside your assigned properties')
    }
    const result = await BookingService.getBookingById(req.params.id)

    res.json({
      success: true,
      message: 'Booking retrieved successfully',
      data: result,
    })
  })
)

/**
 * PUT /api/bookings/:id
 * Update booking status (admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status } = req.body

    if (!status) {
      throw new ValidationError('status is required')
    }

    const result = await BookingService.updateBookingStatus(
      req.params.id,
      status,
      req.user.id,
      req.user.role
    )

    res.json({
      success: true,
      message: 'Booking status updated',
      data: result,
    })
  })
)

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { status } = req.body || {}
    if (!status) throw new ValidationError('status is required')
    if (req.user.ownerScopedStaff) {
      const [booking] = await query('SELECT property_id FROM bookings WHERE id = ?', [req.params.id])
      if (!booking || !req.user.propertyIds.includes(booking.property_id)) throw new ValidationError('Booking is outside your assigned properties')
    }

    const result = await BookingService.updateBookingStatus(
      req.params.id,
      status,
      req.user.id,
      req.user.role
    )

    res.json({ success: true, message: 'Booking status updated', data: result })
  })
)

router.patch(
  '/:id/arrival-details',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await BookingService.updateArrivalDetails(
      req.params.id,
      req.user.id,
      req.body?.arrivalWindow,
      req.body?.specialRequests
    )

    res.json({ success: true, message: 'Arrival details updated', data: result })
  })
)

/**
 * POST /api/bookings/:id/confirm
 * Confirm a booking (admin only)
 */
router.post(
  '/:id/confirm',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await BookingService.updateBookingStatus(
      req.params.id,
      'confirmed',
      req.user.id,
      req.user.role
    )

    res.json({
      success: true,
      message: 'Booking confirmed',
      data: result,
    })
  })
)

/**
 * POST /api/bookings/:id/cancel
 * Cancel a booking
 */
router.post(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const { reason } = req.body

    const result = await BookingService.cancelBooking(req.params.id, req.user.id, reason)

    res.json({
      success: true,
      message: result.message,
    })
  })
)

/**
 * GET /api/bookings/property/:propertyId/availability
 * Check availability for a property
 */
router.get(
  '/property/:propertyId/availability',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required')
    }

    const result = await BookingService.getPropertyBookings(
      req.params.propertyId,
      startDate,
      endDate
    )

    res.json({
      success: true,
      message: 'Availability checked',
      data: {
        propertyId: req.params.propertyId,
        startDate,
        endDate,
        bookings: result,
        isAvailable: result.length === 0,
      },
    })
  })
)

export default router
