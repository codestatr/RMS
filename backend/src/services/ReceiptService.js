import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import PdfService from './PdfService.js';

class ReceiptService {
  async assertAccess(paymentId, user) {
    const payments = await query(
      `SELECT p.id, b.customer_id
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.id = ?`,
      [paymentId]
    );

    if (payments.length === 0) {
      throw new NotFoundError('Payment');
    }

    const staffRole = user?.role === 'admin' || user?.role === 'cashier';
    if (!staffRole && payments[0].customer_id !== user?.id) {
      throw new ValidationError('You do not have permission to access this receipt');
    }

    return true;
  }

  async generateReceiptPdfBuffer(paymentId, branding = {}) {
    const receipt = await this.generateReceipt(paymentId);
    receipt.business = {
      ...receipt.business,
      ...(branding.name ? { name: branding.name } : {}),
      ...(branding.logo ? { logo: branding.logo } : {}),
    };
    return PdfService.generateReceiptPdf(receipt);
  }

  /**
   * Generate or retrieve official receipt for a payment
   */
  async generateReceipt(paymentId) {
    // Get payment details
    const payments = await query(
      `SELECT p.*, 
              b.id as booking_id, b.check_in_date, b.check_out_date, b.number_of_guests, b.total_amount as booking_total,
              pr.name as property_name, pr.address as property_address, pr.type as property_type,
              u.first_name, u.last_name, u.email, u.phone,
              issuer.first_name as issuer_first_name, issuer.last_name as issuer_last_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN properties pr ON b.property_id = pr.id
       JOIN users u ON b.customer_id = u.id
       LEFT JOIN users issuer ON p.issued_by = issuer.id
       WHERE p.id = ?`,
      [paymentId]
    );

    if (payments.length === 0) {
      throw new NotFoundError('Payment');
    }

    const payment = payments[0];

    // Check if receipt already exists
    const existing = await query('SELECT * FROM receipts WHERE payment_id = ?', [paymentId]);

    let receiptNumber;
    let receiptId;

    if (existing.length > 0) {
      receiptNumber = existing[0].receipt_number;
      receiptId = existing[0].id;
    } else {
      receiptId = uuidv4();
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      receiptNumber = `REC-${datePrefix}-${randomSuffix}`;

      await query(
        `INSERT INTO receipts (id, payment_id, receipt_number, created_at)
         VALUES (?, ?, ?, NOW())`,
        [receiptId, paymentId, receiptNumber]
      );
    }

    // Calculate tax and balances
    const amount = parseFloat(payment.amount);
    const taxRate = parseFloat(process.env.TAX_RATE || '0.16');
    const netAmount = amount / (1 + taxRate);
    const taxAmount = amount - netAmount;

    // Get total paid for this booking
    const paidResult = await query(
      'SELECT SUM(amount) as total_paid FROM payments WHERE booking_id = ? AND status IN ("paid", "partially_paid")',
      [payment.booking_id]
    );
    const totalPaid = parseFloat(paidResult[0]?.total_paid || 0);
    const remainingBalance = Math.max(0, parseFloat(payment.booking_total) - totalPaid);

    // Currency handling: KES default, USD for PayPal
    const isInternational = payment.method === 'paypal';
    const currency = isInternational ? 'USD' : 'KES';
    const usdRate = parseFloat(process.env.USD_TO_KES_RATE || '130');
    const amountInUSD = isInternational ? (amount / usdRate).toFixed(2) : null;

    return {
      receiptId,
      receiptNumber,
      paymentId: payment.id,
      bookingId: payment.booking_id,
      customer: {
        name: `${payment.first_name || ''} ${payment.last_name || ''}`.trim() || 'Valued Customer',
        email: payment.email,
        phone: payment.phone,
      },
      property: {
        name: payment.property_name,
        type: payment.property_type,
        address: payment.property_address,
      },
      stay: {
        checkInDate: payment.check_in_date,
        checkOutDate: payment.check_out_date,
        guests: payment.number_of_guests,
      },
      billing: {
        currency,
        amountPaid: amount,
        amountPaidUSD: amountInUSD,
        subtotal: parseFloat(netAmount.toFixed(2)),
        taxRate: `${taxRate * 100}% VAT`,
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        bookingTotal: parseFloat(payment.booking_total),
        totalPaidToDate: totalPaid,
        balanceRemaining: parseFloat(remainingBalance.toFixed(2)),
        paymentMethod: payment.method,
        paymentStatus: payment.status,
        transactionRef: payment.transaction_ref,
        exchangeRate: isInternational ? `1 USD = ${usdRate} KES` : null,
      },
      issuedBy: payment.issuer_first_name
        ? `${payment.issuer_first_name} ${payment.issuer_last_name}`
        : 'System / Online Gateway',
      issuedAt: payment.created_at,
      business: {
        name: process.env.BUSINESS_NAME || 'RMS House Rental & Management',
        email: process.env.BUSINESS_EMAIL || 'support@rms-rentals.com',
        phone: process.env.BUSINESS_PHONE || '+254 700 000000',
        pinNumber: 'P051234567Z',
      },
    };
  }

  /**
   * Get receipt by receipt number
   */
  async getReceiptByNumber(receiptNumber) {
    const receipts = await query('SELECT payment_id FROM receipts WHERE receipt_number = ?', [receiptNumber]);
    if (receipts.length === 0) {
      throw new NotFoundError('Receipt');
    }
    return this.generateReceipt(receipts[0].payment_id);
  }

  /**
   * List all receipts with filters
   */
  async getAllReceipts(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [count] = await query('SELECT COUNT(*) as total FROM receipts');
    const receipts = await query(
      `SELECT r.*, p.amount, p.method, p.status as payment_status, 
              u.first_name, u.last_name, u.email,
              pr.name as property_name
       FROM receipts r
       JOIN payments p ON r.payment_id = p.id
       JOIN bookings b ON p.booking_id = b.id
       JOIN properties pr ON b.property_id = pr.id
       JOIN users u ON b.customer_id = u.id
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return {
      data: receipts,
      pagination: {
        page,
        limit,
        total: count.total,
        pages: Math.ceil(count.total / limit),
      },
    };
  }
}

export default new ReceiptService();
