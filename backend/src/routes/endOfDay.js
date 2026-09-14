import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const cashierClause = req.user.role === 'cashier' ? 'AND p.issued_by = ?' : '';
    const paymentParams = req.user.role === 'cashier' ? [date, date, req.user.id] : [date, date];

    const [payments] = await Promise.all([
      query(
        `SELECT p.method, COUNT(*) AS transaction_count, COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         WHERE p.status = 'paid' AND DATE(p.created_at) BETWEEN ? AND ? ${cashierClause}
         GROUP BY p.method`,
        paymentParams
      ),
    ]);

    const totals = payments.reduce((summary, payment) => {
      summary.totalRevenue += Number(payment.total || 0);
      summary.transactionCount += Number(payment.transaction_count || 0);
      summary.byMethod[payment.method] = Number(payment.total || 0);
      return summary;
    }, { totalRevenue: 0, transactionCount: 0, byMethod: {} });

    const shifts = await query(
      `SELECT s.id, s.open_time, s.close_time, s.opening_balance,
              s.expected_closing_balance, s.actual_closing_balance, s.status,
              u.first_name, u.last_name
       FROM shifts s
       JOIN users u ON s.cashier_id = u.id
       WHERE DATE(s.open_time) = ? ${req.user.role === 'cashier' ? 'AND s.cashier_id = ?' : ''}
       ORDER BY s.open_time DESC`,
      req.user.role === 'cashier' ? [date, req.user.id] : [date]
    );

    res.json({
      success: true,
      data: {
        date,
        ...totals,
        shifts: shifts.map((shift) => ({
          ...shift,
          cashierName: `${shift.first_name || ''} ${shift.last_name || ''}`.trim() || 'Cashier',
        })),
      },
    });
  })
);

export default router;
