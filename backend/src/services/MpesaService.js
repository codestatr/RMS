import axios from 'axios'
import crypto from 'crypto'
import { query, transaction } from '../database/db.js'
import { ValidationError, NotFoundError, ApiError } from '../utils/errors.js'

const MPESA_BASE_URL = process.env.MPESA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('7') || digits.startsWith('1')) return `254${digits}`
  throw new ValidationError('Use a valid Kenyan M-Pesa phone number')
}

function timestamp() {
  const now = new Date()
  const parts = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()]
  return parts.map((part) => String(part).padStart(2, '0')).join('')
}

class MpesaService {
  constructor() {
    this.accessToken = null
    this.accessTokenExpiresAt = 0
    this.statusQueryCache = new Map()
    this.statusQueryQueue = Promise.resolve()
    this.lastStatusQueryAt = 0
    this.statusQueryBlockedUntil = 0
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) return this.accessToken
    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET) {
      throw new ApiError(503, 'M-Pesa sandbox credentials are not configured', 'MPESA_NOT_CONFIGURED')
    }

    const credentials = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64')
    const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
      timeout: 15000,
    })
    this.accessToken = response.data.access_token
    this.accessTokenExpiresAt = Date.now() + Math.max(0, Number(response.data.expires_in || 3600) - 60) * 1000
    return this.accessToken
  }

  async initiateStkPush({ bookingId, amount, phone, accountReference, description }) {
    if (!process.env.MPESA_PASSKEY || !process.env.MPESA_SHORTCODE || !process.env.MPESA_CALLBACK_URL) {
      throw new ApiError(503, 'M-Pesa passkey, shortcode, and callback URL must be configured', 'MPESA_NOT_CONFIGURED')
    }

    const accessToken = await this.getAccessToken()
    const requestTimestamp = timestamp()
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${requestTimestamp}`).toString('base64')
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: requestTimestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(Number(amount)),
        PartyA: normalizePhone(phone),
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: normalizePhone(phone),
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountReference || process.env.MPESA_ACCOUNT_REFERENCE || bookingId,
        TransactionDesc: description || process.env.MPESA_TRANSACTION_DESCRIPTION || 'CozyStay Booking Payment',
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20000 }
    )

    if (response.data.ResponseCode !== '0') {
      throw new ApiError(502, response.data.ResponseDescription || 'M-Pesa STK Push failed', 'MPESA_REQUEST_FAILED')
    }
    return response.data
  }

  async queryStkPush(checkoutRequestId) {
    if (!process.env.MPESA_PASSKEY || !process.env.MPESA_SHORTCODE) return null
    const runQuery = async () => {
      if (Date.now() < this.statusQueryBlockedUntil) return null
      const waitFor = Math.max(0, 2500 - (Date.now() - this.lastStatusQueryAt))
      if (waitFor) await new Promise((resolve) => setTimeout(resolve, waitFor))
      if (Date.now() < this.statusQueryBlockedUntil) return null
      this.lastStatusQueryAt = Date.now()
      const accessToken = await this.getAccessToken()
      const requestTimestamp = timestamp()
      const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${requestTimestamp}`).toString('base64')
      try {
        const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`, {
          BusinessShortCode: process.env.MPESA_SHORTCODE,
          Password: password,
          Timestamp: requestTimestamp,
          CheckoutRequestID: checkoutRequestId,
        }, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 })
        return response.data
      } catch (error) {
        if (error.response?.status === 429) this.statusQueryBlockedUntil = Date.now() + 60000
        throw error
      }
    }
    const pending = this.statusQueryQueue.then(runQuery, runQuery)
    this.statusQueryQueue = pending.catch(() => null)
    return pending
  }

  async reconcilePendingPayment(checkoutRequestId) {
    const cached = this.statusQueryCache.get(checkoutRequestId)
    if (cached && Date.now() - cached.checkedAt < 30000) return cached.promise

    const promise = (async () => {
      try {
        const result = await this.queryStkPush(checkoutRequestId)
        if (String(result?.ResponseCode) !== '0' || result?.ResultCode === undefined) return null
        const resultCode = Number(result.ResultCode)
        const status = resultCode === 0 ? 'paid' : [1, 17, 1032, 1037, 2001].includes(resultCode) ? 'failed' : null
        const note = String(result.ResultDesc || 'M-Pesa status verified').slice(0, 500)
        if (!status) {
          await query("UPDATE guest_service_payments SET notes = ?, updated_at = NOW() WHERE transaction_ref = ? AND status = 'pending'", [note, checkoutRequestId])
          return null
        }
        await transaction(async (connection) => {
          const [bookingPayments] = await connection.execute(
            'SELECT id, booking_id FROM payments WHERE transaction_ref = ? FOR UPDATE', [checkoutRequestId]
          )
          if (bookingPayments.length) {
            const payment = bookingPayments[0]
            await connection.execute('UPDATE payments SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?', [status, note, payment.id])
            if (status === 'paid') {
              await connection.execute(`UPDATE bookings AS b SET status = CASE WHEN (
                SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.booking_id = b.id AND p.status = 'paid'
              ) >= b.total_amount THEN 'confirmed' ELSE b.status END, b.updated_at = NOW() WHERE b.id = ?`, [payment.booking_id])
            }
            return
          }
          const [servicePayments] = await connection.execute(
            'SELECT id, request_id FROM guest_service_payments WHERE transaction_ref = ? FOR UPDATE', [checkoutRequestId]
          )
          if (servicePayments.length) {
            const payment = servicePayments[0]
            await connection.execute('UPDATE guest_service_payments SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?', [status, note, payment.id])
            await connection.execute('UPDATE guest_service_requests SET payment_status = ?, updated_at = NOW() WHERE id = ?', [status, payment.request_id])
            return
          }
          const [walkinOrders] = await connection.execute(
            'SELECT id FROM catering_walkin_orders WHERE transaction_ref = ? FOR UPDATE', [checkoutRequestId]
          )
          if (!walkinOrders.length) return
          await connection.execute(`UPDATE catering_walkin_orders SET payment_status = ?, updated_at = NOW()
            WHERE id = ? AND payment_status = 'pending'`, [status, walkinOrders[0].id])
        })
        return status
      } catch (error) {
        console.error('M-Pesa status query failed:', error.response?.data?.errorMessage || error.message)
        return null
      }
    })()
    this.statusQueryCache.set(checkoutRequestId, { checkedAt: Date.now(), promise })
    const status = await promise
    if (status) this.statusQueryCache.delete(checkoutRequestId)
    return status
  }

  async createStkPayment({ bookingId, amount, phone, issuedBy = null }) {
    const bookings = await query(
      `SELECT b.id, b.total_amount, b.check_in_date, b.check_out_date, p.price_per_night
       FROM bookings b JOIN properties p ON p.id = b.property_id WHERE b.id = ?`,
      [bookingId]
    )
    if (!bookings.length) throw new NotFoundError('Booking')

    const booking = bookings[0]
    const nights = Math.max(1, Math.ceil((new Date(booking.check_out_date) - new Date(booking.check_in_date)) / 86400000))
    const legacySubtotal = nights * Number(booking.price_per_night)
    const storedTotal = Number(booking.total_amount)
    const expectedTotal = Math.round(legacySubtotal * 1.16 * 100) / 100
    if (storedTotal === legacySubtotal && expectedTotal > storedTotal) {
      await query('UPDATE bookings SET total_amount = ?, updated_at = NOW() WHERE id = ?', [expectedTotal, bookingId])
      booking.total_amount = expectedTotal
    }

    if (Number(amount) <= 0 || Number(amount) > Number(booking.total_amount)) {
      throw new ValidationError('Payment amount must be greater than zero and no more than the booking total')
    }

    const response = await this.initiateStkPush({ bookingId, amount, phone })
    const paymentId = crypto.randomUUID()
    await query(
      `INSERT INTO payments (id, booking_id, amount, method, status, transaction_ref, issued_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, 'mpesa', 'pending', ?, ?, ?, NOW(), NOW())`,
      [paymentId, bookingId, amount, response.CheckoutRequestID, issuedBy, `STK request for ${normalizePhone(phone)}`]
    )
    return { paymentId, status: 'pending', checkoutRequestId: response.CheckoutRequestID, customerMessage: response.CustomerMessage }
  }

  async createGuestServiceStkPayment({ requestId, customerId, phone }) {
    const [request] = await query(`SELECT id, service_type, status, quoted_amount, payment_status
      FROM guest_service_requests WHERE id = ? AND customer_id = ?`, [requestId, customerId])
    if (!request) throw new NotFoundError('Guest service request')
    if (request.status !== 'accepted') throw new ValidationError('Wait for the service team to accept and quote your request')
    const amount = Number(request.quoted_amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('This request has no amount due')
    if (request.payment_status === 'paid') throw new ValidationError('This service request is already paid')
    if (request.payment_status === 'pending') throw new ValidationError('An M-Pesa payment is already waiting for confirmation')
    const [acceptedPhoto] = await query(`SELECT response.id FROM guest_service_response_images response
      WHERE response.request_id = ? AND response.guest_response = 'accepted' LIMIT 1`, [requestId])
    const [hasPhotos] = await query('SELECT id FROM guest_service_response_images WHERE request_id = ? LIMIT 1', [requestId])
    if (hasPhotos && !acceptedPhoto) throw new ValidationError('Accept at least one food photo before paying for this catering request')

    const paymentId = crypto.randomUUID()
    await query(`INSERT INTO guest_service_payments (id, request_id, amount, method, status, phone, created_at, updated_at)
      VALUES (?, ?, ?, 'mpesa', 'pending', ?, NOW(), NOW())`, [paymentId, requestId, amount, normalizePhone(phone)])
    await query("UPDATE guest_service_requests SET payment_status = 'pending', updated_at = NOW() WHERE id = ?", [requestId])

    try {
      const response = await this.initiateStkPush({
        bookingId: requestId,
        amount,
        phone,
        accountReference: `GS${requestId.slice(0, 8)}`,
        description: 'Guest service',
      })
      await query('UPDATE guest_service_payments SET transaction_ref = ?, updated_at = NOW() WHERE id = ?', [response.CheckoutRequestID, paymentId])
      return { paymentId, status: 'pending', checkoutRequestId: response.CheckoutRequestID, customerMessage: response.CustomerMessage }
    } catch (error) {
      await query("UPDATE guest_service_payments SET status = 'failed', notes = ?, updated_at = NOW() WHERE id = ?", [String(error.message || 'STK request failed').slice(0, 500), paymentId])
      await query("UPDATE guest_service_requests SET payment_status = 'failed', updated_at = NOW() WHERE id = ?", [requestId])
      throw error
    }
  }

  async createCateringWalkinStkPayment({ orderId, phone }) {
    const [order] = await query(`SELECT id, guest_name, phone, quoted_amount, payment_method, payment_status, status
      FROM catering_walkin_orders WHERE id = ?`, [orderId])
    if (!order) throw new NotFoundError('Walk-in catering order')
    if (order.status !== 'accepted') throw new ValidationError('Only a new walk-in order can be paid')
    if (order.payment_method !== 'mpesa') throw new ValidationError('This walk-in order is set to cash payment')
    if (order.payment_status === 'paid') throw new ValidationError('This walk-in order is already paid')
    if (order.payment_status === 'pending') throw new ValidationError('An M-Pesa prompt is already waiting for confirmation')
    const paymentPhone = normalizePhone(phone || order.phone)
    const claim = await query(`UPDATE catering_walkin_orders SET payment_status = 'pending', phone = ?, updated_at = NOW()
      WHERE id = ? AND payment_status IN ('unpaid', 'failed')`, [paymentPhone, order.id])
    if (claim.affectedRows !== 1) throw new ValidationError('Another M-Pesa prompt is already being processed for this order')
    try {
      const response = await this.initiateStkPush({
        bookingId: order.id,
        amount: order.quoted_amount,
        phone: paymentPhone,
        accountReference: `CAT${order.id.slice(0, 8)}`,
        description: `Catering order ${order.guest_name}`,
      })
      await query(`UPDATE catering_walkin_orders SET transaction_ref = ?, updated_at = NOW() WHERE id = ?`,
        [response.CheckoutRequestID, order.id])
      return { status: 'pending', checkoutRequestId: response.CheckoutRequestID, customerMessage: response.CustomerMessage }
    } catch (error) {
      await query(`UPDATE catering_walkin_orders SET payment_status = 'failed', updated_at = NOW()
        WHERE id = ? AND payment_status = 'pending'`, [order.id])
      throw error
    }
  }

  async handleCallback(payload) {
    const callback = payload?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) throw new ValidationError('Invalid M-Pesa callback payload')

    const resultCode = Number(callback.ResultCode)
    const metadata = Object.fromEntries((callback.CallbackMetadata?.Item || []).map((item) => [item.Name, item.Value]))
    const status = resultCode === 0 ? 'paid' : 'failed'
    const note = `${callback.ResultDesc || ''}${metadata.MpesaReceiptNumber ? ` | receipt:${metadata.MpesaReceiptNumber}` : ''}`
    await transaction(async (connection) => {
      const [payments] = await connection.execute(
        'SELECT id, booking_id, amount, status FROM payments WHERE transaction_ref = ? FOR UPDATE',
        [callback.CheckoutRequestID]
      )
      if (payments.length === 0) {
        const [servicePayments] = await connection.execute(
          'SELECT id, request_id, status FROM guest_service_payments WHERE transaction_ref = ? FOR UPDATE',
          [callback.CheckoutRequestID]
        )
        if (!servicePayments.length) {
          const [walkinOrders] = await connection.execute(
            'SELECT id, payment_status FROM catering_walkin_orders WHERE transaction_ref = ? FOR UPDATE',
            [callback.CheckoutRequestID]
          )
          if (!walkinOrders.length) return
          await connection.execute(`UPDATE catering_walkin_orders SET payment_status = ?, receipt_number = ?, updated_at = NOW()
            WHERE id = ?`, [status, metadata.MpesaReceiptNumber || null, walkinOrders[0].id])
          return
        }
        const servicePayment = servicePayments[0]
        await connection.execute(
          'UPDATE guest_service_payments SET status = ?, receipt_number = ?, notes = ?, updated_at = NOW() WHERE id = ?',
          [status, metadata.MpesaReceiptNumber || null, note.slice(0, 500), servicePayment.id]
        )
        await connection.execute('UPDATE guest_service_requests SET payment_status = ?, updated_at = NOW() WHERE id = ?', [status, servicePayment.request_id])
        return
      }

      const payment = payments[0]
      await connection.execute(
        'UPDATE payments SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?',
        [status, note, payment.id]
      )

      if (status === 'paid') {
        await connection.execute(
          `UPDATE bookings AS b
           SET status = CASE WHEN (
             SELECT COALESCE(SUM(p.amount), 0) FROM payments p
             WHERE p.booking_id = b.id AND p.status = 'paid'
           ) >= b.total_amount THEN 'confirmed' ELSE b.status END,
           b.updated_at = NOW()
           WHERE b.id = ?`,
          [payment.booking_id]
        )
      }
    })
    return { status, checkoutRequestId: callback.CheckoutRequestID, receipt: metadata.MpesaReceiptNumber || null }
  }

  async getPaymentStatus(checkoutRequestId, user = null) {
    let payments = await query(
      `SELECT id, booking_id, amount, method, status, transaction_ref, updated_at
       FROM payments WHERE transaction_ref = ?`,
      [checkoutRequestId]
    )
    if (payments.length && payments[0].status === 'pending') {
      await this.reconcilePendingPayment(checkoutRequestId)
      payments = await query(`SELECT id, booking_id, amount, method, status, transaction_ref, updated_at
        FROM payments WHERE transaction_ref = ?`, [checkoutRequestId])
    }
    if (payments.length) return payments[0]
    let servicePayments = await query(
      `SELECT id, request_id AS guest_service_request_id, amount, method, status, transaction_ref, receipt_number, updated_at
       FROM guest_service_payments WHERE transaction_ref = ?`,
      [checkoutRequestId]
    )
    if (!servicePayments.length) {
      let walkinOrders = await query(`SELECT id AS walkin_order_id, quoted_amount AS amount, payment_method AS method,
          payment_status AS status, transaction_ref, receipt_number, updated_at
        FROM catering_walkin_orders WHERE transaction_ref = ?`, [checkoutRequestId])
      if (!walkinOrders.length || !['admin', 'catering', 'cashier'].includes(user?.role)) throw new NotFoundError('M-Pesa payment')
      if (walkinOrders[0].status === 'pending') {
        await this.reconcilePendingPayment(checkoutRequestId)
        walkinOrders = await query(`SELECT id AS walkin_order_id, quoted_amount AS amount, payment_method AS method,
            payment_status AS status, transaction_ref, receipt_number, updated_at
          FROM catering_walkin_orders WHERE transaction_ref = ?`, [checkoutRequestId])
      }
      return walkinOrders[0]
    }
    if (servicePayments[0].status === 'pending') {
      await this.reconcilePendingPayment(checkoutRequestId)
      servicePayments = await query(`SELECT id, request_id AS guest_service_request_id, amount, method, status, transaction_ref, receipt_number, updated_at
        FROM guest_service_payments WHERE transaction_ref = ?`, [checkoutRequestId])
    }
    if (user?.role === 'customer') {
      const [ownership] = await query(`SELECT id FROM guest_service_requests
        WHERE id = ? AND customer_id = ?`, [servicePayments[0].guest_service_request_id, user.id])
      if (!ownership) throw new NotFoundError('M-Pesa payment')
    }
    return servicePayments[0]
  }
}

export default new MpesaService()
