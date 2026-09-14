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
        TransactionDesc: description || process.env.MPESA_TRANSACTION_DESCRIPTION || 'RMS Booking Payment',
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20000 }
    )

    if (response.data.ResponseCode !== '0') {
      throw new ApiError(502, response.data.ResponseDescription || 'M-Pesa STK Push failed', 'MPESA_REQUEST_FAILED')
    }
    return response.data
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
      if (payments.length === 0) return

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

  async getPaymentStatus(checkoutRequestId) {
    const payments = await query(
      `SELECT id, booking_id, amount, method, status, transaction_ref, updated_at
       FROM payments WHERE transaction_ref = ?`,
      [checkoutRequestId]
    )
    if (!payments.length) throw new NotFoundError('M-Pesa payment')
    return payments[0]
  }
}

export default new MpesaService()
