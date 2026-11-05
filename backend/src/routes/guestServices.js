import express from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../utils/errors.js'
import GuestServiceService from '../services/GuestServiceService.js'
import MpesaService from '../services/MpesaService.js'
import { query } from '../database/db.js'
import { v4 as uuidv4 } from 'uuid'
import { ValidationError, NotFoundError } from '../utils/errors.js'

const router = express.Router()

router.get('/mine', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.getMine(req.user.id)
  res.json({ success: true, data })
}))

router.post('/', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.create(req.user, req.body || {})
  res.status(201).json({ success: true, message: 'Service request sent to the property team', data })
}))

router.post('/:id/payment/mpesa', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const data = await MpesaService.createGuestServiceStkPayment({ requestId: req.params.id, customerId: req.user.id, phone: req.body?.phone })
  res.status(201).json({ success: true, message: 'M-Pesa prompt sent for your service payment', data })
}))

router.patch('/mine/:id/photos/:imageId', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.respondToPhoto(req.params.id, req.params.imageId, req.body?.decision, req.user.id)
  res.json({ success: true, message: 'Food photo response saved', data })
}))

// Menu browsing is read-only and public so guests can view available items without
// depending on a customer token. Management routes below remain staff-only.
router.get('/catering-menu', asyncHandler(async (_req, res) => {
  const data = await GuestServiceService.getCateringMenu(false)
  res.json({ success: true, data })
}))

router.post('/catering-menu', authenticate, requireRole('admin', 'catering'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.createCateringMenuItem(req.user, req.body || {})
  res.status(201).json({ success: true, message: 'Catering menu item added', data })
}))

router.patch('/catering-menu/:id/availability', authenticate, requireRole('admin', 'catering'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.setCateringMenuItemAvailability(req.params.id, req.body?.isAvailable)
  res.json({ success: true, message: 'Catering menu availability updated', data })
}))

router.get('/catering-walkins', authenticate, requireRole('admin', 'catering'), asyncHandler(async (_req, res) => {
  const data = await query(`SELECT * FROM catering_walkin_orders
    ORDER BY FIELD(status, 'accepted', 'in_progress', 'completed', 'cancelled'), created_at DESC LIMIT 300`)
  res.json({ success: true, data })
}))

router.post('/catering-walkins', authenticate, requireRole('admin', 'catering'), asyncHandler(async (req, res) => {
  const guestName = String(req.body?.guestName || '').trim().slice(0, 200)
  const phone = String(req.body?.phone || '').trim().slice(0, 30)
  const orderDetails = String(req.body?.orderDetails || '').trim().slice(0, 2000)
  const amount = Number(req.body?.amount)
  const paymentMethod = req.body?.paymentMethod
  if (!guestName || !orderDetails || !Number.isFinite(amount) || amount <= 0 || amount > 99999999.99 || !['cash', 'mpesa'].includes(paymentMethod) || (paymentMethod === 'mpesa' && !phone)) {
    throw new ValidationError('Enter the guest name, order, positive total, payment method, and M-Pesa phone for prompt payments')
  }
  const id = uuidv4()
  await query(`INSERT INTO catering_walkin_orders
    (id, guest_name, phone, order_details, quoted_amount, payment_method, handled_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, guestName, phone || null, orderDetails, amount, paymentMethod, req.user.id])
  const [data] = await query('SELECT * FROM catering_walkin_orders WHERE id = ?', [id])
  res.status(201).json({ success: true, message: 'Walk-in catering order created', data })
}))

router.post('/catering-walkins/:id/payment/mpesa', authenticate, requireRole('admin', 'catering'), asyncHandler(async (req, res) => {
  const data = await MpesaService.createCateringWalkinStkPayment({ orderId: req.params.id, phone: req.body?.phone })
  res.status(201).json({ success: true, message: 'M-Pesa prompt sent for the walk-in catering order', data })
}))

router.patch('/catering-walkins/:id', authenticate, requireRole('admin', 'catering'), asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM catering_walkin_orders WHERE id = ?', [req.params.id])
  if (!order) throw new NotFoundError('Walk-in catering order')
  const { action, receiptNumber } = req.body || {}
  if (action === 'payment') {
    if (order.status !== 'accepted') throw new ValidationError('Payment can only be recorded for an active walk-in order')
    if (order.payment_status === 'paid') throw new ValidationError('This walk-in order is already paid')
    const receipt = String(receiptNumber || '').trim().toUpperCase()
    if (order.payment_method === 'mpesa' && !/^[A-Z0-9]{5,20}$/.test(receipt)) throw new ValidationError('Enter the M-Pesa receipt code after checking the guest confirmation')
    await query(`UPDATE catering_walkin_orders SET payment_status = 'paid', receipt_number = ?, handled_by = ?, updated_at = NOW() WHERE id = ?`,
      [order.payment_method === 'mpesa' ? receipt : null, req.user.id, order.id])
  } else if (action === 'start') {
    if (order.status !== 'accepted') throw new ValidationError('Only a newly accepted order can be sent to the kitchen')
    if (order.payment_status !== 'paid') throw new ValidationError('Confirm payment before starting food preparation')
    await query(`UPDATE catering_walkin_orders SET status = 'in_progress', handled_by = ?, updated_at = NOW() WHERE id = ?`, [req.user.id, order.id])
  } else if (action === 'complete') {
    if (order.status !== 'in_progress') throw new ValidationError('Only an order being prepared can be marked ready')
    await query(`UPDATE catering_walkin_orders SET status = 'completed', handled_by = ?, updated_at = NOW() WHERE id = ?`, [req.user.id, order.id])
  } else {
    throw new ValidationError('Choose a valid walk-in order action')
  }
  const [data] = await query('SELECT * FROM catering_walkin_orders WHERE id = ?', [order.id])
  res.json({ success: true, data })
}))

router.get('/', authenticate, requireRole('admin', 'cashier', 'property_owner', 'housekeeping', 'catering'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.getForStaff(req.user)
  res.json({ success: true, data })
}))

router.patch('/:id/photos', authenticate, requireRole('admin', 'catering'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.shareMenuItems(req.params.id, req.body?.menuItemIds, req.user)
  res.json({ success: true, message: 'Food photos sent to guest', data })
}))

router.post('/:id/payment/verify', authenticate, requireRole('admin', 'cashier', 'catering'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.verifyGuestServicePayment(req.params.id, req.body?.receiptNumber, req.user)
  res.json({ success: true, message: 'M-Pesa receipt verified; the catering order can proceed', data })
}))

router.patch('/:id', authenticate, requireRole('admin', 'cashier', 'property_owner', 'housekeeping', 'catering'), asyncHandler(async (req, res) => {
  const data = await GuestServiceService.update(req.params.id, req.body || {}, req.user)
  res.json({ success: true, message: 'Guest service request updated', data })
}))

export default router
