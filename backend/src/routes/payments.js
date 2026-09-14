import express from 'express'
import PaymentService from '../services/PaymentService.js'
import MpesaService from '../services/MpesaService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'

const router = express.Router()

/**
 * POST /api/payments/mpesa/stk-push
 * Initiate an M-Pesa sandbox STK Push
 */
router.post(
  '/mpesa/stk-push',
  authenticate,
  asyncHandler(async (req, res) => {
    const { bookingId, amount, phone } = req.body
    if (!bookingId || !amount || !phone) {
      throw new ValidationError('bookingId, amount, and phone are required')
    }

    const result = await MpesaService.createStkPayment({
      bookingId,
      amount,
      phone,
      issuedBy: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: 'M-Pesa STK Push sent',
      data: result,
    })
  })
)

/**
 * GET /api/payments/mpesa/status/:checkoutRequestId
 * Read asynchronous STK Push result after callback processing
 */
router.get(
  '/mpesa/status/:checkoutRequestId',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await MpesaService.getPaymentStatus(req.params.checkoutRequestId)
    res.json({ success: true, data: result })
  })
)

/**
 * POST /api/payments
 * Create a new payment
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { bookingId, amount, method, transactionRef } = req.body

    if (!bookingId || !amount || !method) {
      throw new ValidationError('bookingId, amount, and method are required')
    }

    const result = await PaymentService.createPayment(
      bookingId,
      amount,
      method,
      req.user.id,
      transactionRef,
    )

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: result,
    })
  })
)

/**
 * GET /api/payments
 * Get all payments (admin only)
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, method, startDate, endDate } = req.query

    const filters = {
      status: status || null,
      method: method || null,
      startDate: startDate || null,
      endDate: endDate || null,
    }

    const result = await PaymentService.getAllPayments(filters, page, limit)

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      data: result,
    })
  })
)

/**
 * GET /api/payments/:id
 * Get payment details
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await PaymentService.getPaymentById(req.params.id)

    res.json({
      success: true,
      message: 'Payment retrieved successfully',
      data: result,
    })
  })
)

/**
 * GET /api/payments/booking/:bookingId
 * Get payments for a specific booking
 */
router.get(
  '/booking/:bookingId',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await PaymentService.getBookingPayments(req.params.bookingId)

    res.json({
      success: true,
      message: 'Booking payments retrieved successfully',
      data: result,
    })
  })
)

/**
 * PUT /api/payments/:id
 * Update payment status (admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { status } = req.body

    if (!status) {
      throw new ValidationError('status is required')
    }

    const result = await PaymentService.updatePaymentStatus(req.params.id, status)

    res.json({
      success: true,
      message: 'Payment status updated',
      data: result,
    })
  })
)

/**
 * POST /api/payments/:id/refund
 * Refund a payment (admin only)
 */
router.post(
  '/:id/refund',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body

    const result = await PaymentService.refundPayment(req.params.id, reason)

    res.json({
      success: true,
      message: 'Payment refunded successfully',
      data: result,
    })
  })
)

/**
 * GET /api/payments/reports/revenue
 * Get revenue statistics
 */
router.get(
  '/reports/revenue',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { date } = req.query

    if (!date) {
      throw new ValidationError('date is required (YYYY-MM-DD format)')
    }

    const result = await PaymentService.getDailyRevenue(date)

    res.json({
      success: true,
      message: 'Daily revenue retrieved',
      data: result,
    })
  })
)

/**
 * GET /api/payments/reports/by-method
 * Get revenue by payment method
 */
router.get(
  '/reports/by-method',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query

    const result = await PaymentService.getRevenueByMethod(startDate, endDate)

    res.json({
      success: true,
      message: 'Revenue by method retrieved',
      data: result,
    })
  })
)

/**
 * GET /api/payments/reports/outstanding
 * Get outstanding payments
 */
router.get(
  '/reports/outstanding',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query

    const result = await PaymentService.getOutstandingPayments(page, limit)

    res.json({
      success: true,
      message: 'Outstanding payments retrieved',
      data: result,
    })
  })
)

/**
 * POST /api/payments/webhook/stripe
 * Stripe webhook handler
 */
router.post(
  '/webhook/stripe',
  asyncHandler(async (req, res) => {
    // TODO: Implement Stripe webhook verification and processing
    const { type, data } = req.body

    console.log('Stripe webhook received:', type)

    res.json({
      success: true,
      message: 'Webhook received',
    })
  })
)

/**
 * POST /api/payments/webhook/mpesa
 * M-Pesa webhook handler
 */
router.post(
  '/webhook/mpesa',
  asyncHandler(async (req, res) => {
    const result = await MpesaService.handleCallback(req.body)

    res.json({
      success: true,
      message: 'M-Pesa callback processed',
      data: result,
    })
  })
)

export default router
