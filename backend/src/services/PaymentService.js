import { v4 as uuidv4 } from 'uuid'
import { query, transaction } from '../database/db.js'
import {
  ValidationError,
  NotFoundError,
} from '../utils/errors.js'
import {
  validatePaymentMethod,
  validatePaymentStatus,
  validateDecimal,
  sanitizeInput,
} from '../utils/validation.js'
import NotificationService from './NotificationService.js'
import ReceiptService from './ReceiptService.js'

class PaymentService {
  /**
   * Create payment
   */
  async createPayment(bookingId, amount, method, issuedBy = null, transactionRef = null) {
    const sanitized = sanitizeInput({ bookingId, amount, method, transactionRef })

    // Validate input
    if (!sanitized.bookingId || !sanitized.amount || !sanitized.method) {
      throw new ValidationError('Missing required fields')
    }

    if (!validatePaymentMethod(sanitized.method)) {
      throw new ValidationError('Invalid payment method')
    }

    if (!validateDecimal(sanitized.amount, 10, 2)) {
      throw new ValidationError('Invalid amount format')
    }

    // Get booking
    const bookings = await query(
      `SELECT b.id, b.total_amount, b.status, b.check_in_date, b.check_out_date, p.price_per_night
       FROM bookings b JOIN properties p ON p.id = b.property_id WHERE b.id = ?`,
      [sanitized.bookingId]
    )

    if (bookings.length === 0) {
      throw new NotFoundError('Booking')
    }

    const booking = bookings[0]

    const nights = Math.max(1, Math.ceil((new Date(booking.check_out_date) - new Date(booking.check_in_date)) / 86400000))
    const legacySubtotal = nights * Number(booking.price_per_night)
    const storedTotal = Number(booking.total_amount)
    const expectedTotal = Math.round(legacySubtotal * 1.16 * 100) / 100
    if (storedTotal === legacySubtotal && expectedTotal > storedTotal) {
      await query('UPDATE bookings SET total_amount = ?, updated_at = NOW() WHERE id = ?', [expectedTotal, sanitized.bookingId])
      booking.total_amount = expectedTotal
    }

    // Check if payment exceeds booking amount
    if (sanitized.amount > booking.total_amount) {
      throw new ValidationError('Payment amount exceeds booking total')
    }

    // Get existing payments
    const existingPayments = await query(
      'SELECT SUM(amount) as total FROM payments WHERE booking_id = ? AND status IN ("paid", "partially_paid")',
      [sanitized.bookingId]
    )

    const paidAmount = existingPayments[0].total || 0
    const remainingAmount = booking.total_amount - paidAmount

    if (sanitized.amount > remainingAmount) {
      throw new ValidationError('Payment amount exceeds remaining balance')
    }

    // Create payment
    const paymentId = uuidv4()
    const status = sanitized.amount >= remainingAmount
      ? (sanitized.method === 'cash' ? 'paid' : 'pending')
      : 'partially_paid'

    await query(
      `INSERT INTO payments (
        id, booking_id, amount, method, status, transaction_ref, issued_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [paymentId, sanitized.bookingId, sanitized.amount, sanitized.method, status, sanitized.transactionRef || null, issuedBy]
    )

    // If payment is complete, update booking status
    if (paidAmount + sanitized.amount >= booking.total_amount && status !== 'pending') {
      await query('UPDATE bookings SET status = "confirmed" WHERE id = ?', [
        sanitized.bookingId,
      ])
    }

    const paymentDetails = await this.getPaymentById(paymentId)
    
    // Send email receipt notification with PDF attachment
    if (paymentDetails.email && status === 'paid') {
      try {
        const pdfBuffer = await ReceiptService.generateReceiptPdfBuffer(paymentId);
        NotificationService.sendPaymentReceipt(
          paymentDetails.email,
          paymentDetails.first_name,
          {
            receiptNumber: paymentDetails.transaction_ref || paymentId.split('-')[0].toUpperCase(),
            amount: sanitized.amount
          },
          pdfBuffer
        );
      } catch (err) {
        console.error('Failed to generate or send PDF receipt', err);
      }
    }

    return paymentDetails
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId) {
    const payments = await query(
            `SELECT p.*, b.total_amount, b.check_in_date, b.check_out_date,
              pr.name as property_name, pr.address as property_address,
              u.first_name, u.last_name, u.email,
              issuer.first_name as issuer_first_name, issuer.last_name as issuer_last_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN properties pr ON b.property_id = pr.id
       JOIN users u ON b.customer_id = u.id
             LEFT JOIN users issuer ON p.issued_by = issuer.id
       WHERE p.id = ?`,
      [paymentId]
    )

    if (payments.length === 0) {
      throw new NotFoundError('Payment')
    }

    return this.formatPayment(payments[0])
  }

  /**
   * Get booking payments
   */
  async getBookingPayments(bookingId) {
    const payments = await query(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC',
      [bookingId]
    )

    return payments.map((payment) => this.formatPayment(payment))
  }

  /**
   * Get all payments (admin)
   */
  async getAllPayments(filters = {}, page = 1, limit = 20) {
    const { status, method, startDate, endDate } = filters

    let whereClause = 'WHERE 1=1'
    const params = []

    if (status) {
      whereClause += ' AND p.status = ?'
      params.push(status)
    }

    if (method) {
      whereClause += ' AND p.method = ?'
      params.push(method)
    }

    if (startDate) {
      whereClause += ' AND DATE(p.created_at) >= ?'
      params.push(startDate)
    }

    if (endDate) {
      whereClause += ' AND DATE(p.created_at) <= ?'
      params.push(endDate)
    }

    const offset = (page - 1) * limit

    const countResult = await query(
      `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const payments = await query(
      `SELECT p.*, b.total_amount, pr.name as property_name, u.first_name, u.last_name,
          issuer.first_name as issuer_first_name, issuer.last_name as issuer_last_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN properties pr ON b.property_id = pr.id
       JOIN users u ON b.customer_id = u.id
       LEFT JOIN users issuer ON p.issued_by = issuer.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      data: payments.map((payment) => this.formatPayment(payment)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(paymentId, newStatus) {
    if (!validatePaymentStatus(newStatus)) {
      throw new ValidationError('Invalid payment status')
    }

    await query('UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?', [
      newStatus,
      paymentId,
    ])

    return this.getPaymentById(paymentId)
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, reason = null) {
    const payments = await query('SELECT id, status, booking_id FROM payments WHERE id = ?', [
      paymentId,
    ])

    if (payments.length === 0) {
      throw new NotFoundError('Payment')
    }

    if (payments[0].status !== 'paid') {
      throw new ValidationError('Only paid payments can be refunded')
    }

    await query(
      'UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?',
      ['refunded', paymentId]
    )

    return this.getPaymentById(paymentId)
  }

  /**
   * Get daily revenue
   */
  async getDailyRevenue(date) {
    const result = await query(
      `SELECT SUM(amount) as total, COUNT(*) as transaction_count
       FROM payments
       WHERE status = 'paid' AND DATE(created_at) = ?`,
      [date]
    )

    return {
      date,
      totalRevenue: result[0].total || 0,
      transactionCount: result[0].transaction_count || 0,
    }
  }

  /**
   * Get revenue by method
   */
  async getRevenueByMethod(startDate = null, endDate = null) {
    let whereClause = 'WHERE status = "paid"'
    const params = []

    if (startDate) {
      whereClause += ' AND DATE(created_at) >= ?'
      params.push(startDate)
    }

    if (endDate) {
      whereClause += ' AND DATE(created_at) <= ?'
      params.push(endDate)
    }

    const result = await query(
      `SELECT method, SUM(amount) as total, COUNT(*) as count
       FROM payments
       ${whereClause}
       GROUP BY method`,
      params
    )

    return result
  }

  /**
   * Get outstanding payments
   */
  async getOutstandingPayments(page = 1, limit = 20) {
    const offset = (page - 1) * limit

    const countResult = await query(
      `SELECT COUNT(DISTINCT b.id) as total
       FROM bookings b
       WHERE b.status IN ('pending', 'confirmed')
       AND (
         SELECT SUM(p.amount) FROM payments p 
         WHERE p.booking_id = b.id AND p.status = 'paid'
       ) < b.total_amount`,
      []
    )

    const bookings = await query(
      `SELECT DISTINCT b.id, b.total_amount,
              (SELECT SUM(p.amount) FROM payments p 
               WHERE p.booking_id = b.id AND p.status = 'paid') as paid_amount,
              b.total_amount - (
                SELECT SUM(p.amount) FROM payments p 
                WHERE p.booking_id = b.id AND p.status = 'paid'
              ) as outstanding_amount,
              u.first_name, u.last_name, u.email
       FROM bookings b
       JOIN users u ON b.customer_id = u.id
       WHERE b.status IN ('pending', 'confirmed')
       AND (
         SELECT SUM(p.amount) FROM payments p 
         WHERE p.booking_id = b.id AND p.status = 'paid'
       ) < b.total_amount
       LIMIT ? OFFSET ?`,
      [limit, offset]
    )

    return {
      data: bookings,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit),
      },
    }
  }

  /**
   * Format payment object
   */
  formatPayment(payment) {
    return {
      id: payment.id,
      bookingId: payment.booking_id,
      propertyName: payment.property_name,
      propertyAddress: payment.property_address,
      customerName: `${payment.first_name} ${payment.last_name}`,
      customerEmail: payment.email,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      transactionRef: payment.transaction_ref,
      issuedBy: `${payment.issuer_first_name || ''} ${payment.issuer_last_name || ''}`.trim() || 'System / Online Gateway',
      bookingTotal: payment.total_amount,
      checkInDate: payment.check_in_date,
      checkOutDate: payment.check_out_date,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    }
  }
}

export default new PaymentService()
