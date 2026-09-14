import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

class ShiftService {
  /**
   * Open a new cashier shift
   */
  async openShift(cashierId, openingBalance = 0, notes = null) {
    // Check if cashier already has an active open shift
    const active = await query(
      'SELECT id FROM shifts WHERE cashier_id = ? AND status = "open"',
      [cashierId]
    );

    if (active.length > 0) {
      throw new ValidationError('Cashier already has an active open shift. Please close it first.');
    }

    const shiftId = uuidv4();
    await query(
      `INSERT INTO shifts (
        id, cashier_id, open_time, opening_balance, status, notes, created_at, updated_at
      ) VALUES (?, ?, NOW(), ?, 'open', ?, NOW(), NOW())`,
      [shiftId, cashierId, openingBalance, notes]
    );

    return this.getShiftById(shiftId);
  }

  /**
   * Get shift by ID
   */
  async getShiftById(shiftId) {
    const shifts = await query(
      `SELECT s.*, u.first_name as cashier_first_name, u.last_name as cashier_last_name, u.email as cashier_email
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ?`,
      [shiftId]
    );

    if (shifts.length === 0) {
      throw new NotFoundError('Shift');
    }

    return this.formatShift(shifts[0]);
  }

  /**
   * Get active shift for a cashier
   */
  async getActiveShift(cashierId) {
    const shifts = await query(
      `SELECT s.*, u.first_name as cashier_first_name, u.last_name as cashier_last_name, u.email as cashier_email
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.cashier_id = ? AND s.status = 'open'
       ORDER BY s.open_time DESC
       LIMIT 1`,
      [cashierId]
    );

    if (shifts.length === 0) {
      return null;
    }

    const shift = shifts[0];

    // Compute live metrics for this active shift
    const stats = await query(
      `SELECT COUNT(*) as tx_count, 
              SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_total,
              SUM(amount) as total_collected
       FROM payments
       WHERE issued_by = ? AND created_at >= ? AND status = 'paid'`,
      [cashierId, shift.open_time]
    );

    const liveStats = stats[0] || {};
    const expectedClosing = (shift.opening_balance || 0) + (liveStats.cash_total || 0);

    return {
      ...this.formatShift(shift),
      liveTransactionCount: liveStats.tx_count || 0,
      liveCashCollected: liveStats.cash_total || 0,
      liveTotalCollected: liveStats.total_collected || 0,
      liveExpectedCash: expectedClosing,
    };
  }

  /**
   * Close an active shift and reconcile drawer
   */
  async closeShift(shiftId, actualClosingBalance, notes = null) {
    const shifts = await query('SELECT * FROM shifts WHERE id = ?', [shiftId]);

    if (shifts.length === 0) {
      throw new NotFoundError('Shift');
    }

    const shift = shifts[0];
    if (shift.status === 'closed') {
      throw new ValidationError('Shift is already closed');
    }

    // Calculate cash payments during shift
    const stats = await query(
      `SELECT COUNT(*) as tx_count, 
              SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_total
       FROM payments
       WHERE issued_by = ? AND created_at >= ? AND status = 'paid'`,
      [shift.cashier_id, shift.open_time]
    );

    const txCount = stats[0]?.tx_count || 0;
    const cashTotal = stats[0]?.cash_total || 0;
    const expectedBalance = (shift.opening_balance || 0) + cashTotal;
    const closingNotes = notes || shift.notes;

    await query(
      `UPDATE shifts SET 
        close_time = NOW(),
        expected_closing_balance = ?,
        actual_closing_balance = ?,
        transaction_count = ?,
        status = 'closed',
        notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [expectedBalance, actualClosingBalance, txCount, closingNotes, shiftId]
    );

    const closed = await this.getShiftById(shiftId);
    const discrepancy = actualClosingBalance - expectedBalance;

    return {
      ...closed,
      discrepancy,
      discrepancyStatus: discrepancy === 0 ? 'balanced' : discrepancy > 0 ? 'overage' : 'shortage',
    };
  }

  /**
   * Get all shifts with filtering (Admin / POS Admin)
   */
  async getAllShifts(filters = {}, page = 1, limit = 20) {
    const { cashierId, status, startDate, endDate } = filters;
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (cashierId) {
      whereClause += ' AND s.cashier_id = ?';
      params.push(cashierId);
    }

    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }

    if (startDate) {
      whereClause += ' AND DATE(s.open_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(s.open_time) <= ?';
      params.push(endDate);
    }

    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM shifts s ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    const shifts = await query(
      `SELECT s.*, u.first_name as cashier_first_name, u.last_name as cashier_last_name, u.email as cashier_email
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       ${whereClause}
       ORDER BY s.open_time DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: shifts.map((s) => this.formatShift(s)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  formatShift(shift) {
    const opening = parseFloat(shift.opening_balance || 0);
    const expected = shift.expected_closing_balance !== null ? parseFloat(shift.expected_closing_balance) : null;
    const actual = shift.actual_closing_balance !== null ? parseFloat(shift.actual_closing_balance) : null;
    const diff = expected !== null && actual !== null ? actual - expected : null;

    return {
      id: shift.id,
      cashierId: shift.cashier_id,
      cashierName: `${shift.cashier_first_name || ''} ${shift.cashier_last_name || ''}`.trim() || 'Cashier',
      cashierEmail: shift.cashier_email,
      openTime: shift.open_time,
      closeTime: shift.close_time,
      openingBalance: opening,
      expectedClosingBalance: expected,
      actualClosingBalance: actual,
      discrepancy: diff,
      transactionCount: shift.transaction_count || 0,
      status: shift.status,
      notes: shift.notes,
      createdAt: shift.created_at,
      updatedAt: shift.updated_at,
    };
  }
}

export default new ShiftService();
