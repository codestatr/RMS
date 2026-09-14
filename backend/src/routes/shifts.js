import express from 'express';
import ShiftService from '../services/ShiftService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../utils/errors.js';

const router = express.Router();

/**
 * POST /api/shifts/open
 * Open a new shift for the authenticated cashier
 */
router.post(
  '/open',
  authenticate,
  requireRole('cashier', 'admin'),
  asyncHandler(async (req, res) => {
    const { openingBalance = 0, notes } = req.body;
    const result = await ShiftService.openShift(req.user.id, parseFloat(openingBalance), notes);

    res.status(201).json({
      success: true,
      message: 'Shift opened successfully',
      data: result,
    });
  })
);

/**
 * GET /api/shifts/active
 * Get active shift for current cashier
 */
router.get(
  '/active',
  authenticate,
  requireRole('cashier', 'admin'),
  asyncHandler(async (req, res) => {
    const result = await ShiftService.getActiveShift(req.user.id);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/shifts/:id/close
 * Close an active shift with actual closing balance
 */
router.post(
  '/:id/close',
  authenticate,
  requireRole('cashier', 'admin'),
  asyncHandler(async (req, res) => {
    const { actualClosingBalance, notes } = req.body;

    if (actualClosingBalance === undefined || actualClosingBalance === null) {
      throw new ValidationError('Actual closing balance is required');
    }

    const result = await ShiftService.closeShift(
      req.params.id,
      parseFloat(actualClosingBalance),
      notes
    );

    res.json({
      success: true,
      message: 'Shift closed and reconciled successfully',
      data: result,
    });
  })
);

/**
 * GET /api/shifts
 * List shifts with filters (Admin and POS Admin)
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, cashierId, status, startDate, endDate } = req.query;

    // Cashiers only see their own shifts unless admin
    const targetCashier = req.user.role === 'admin' ? cashierId : req.user.id;

    const result = await ShiftService.getAllShifts(
      { cashierId: targetCashier, status, startDate, endDate },
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/shifts/:id
 * Get single shift detail
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await ShiftService.getShiftById(req.params.id);

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
