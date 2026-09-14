import express from 'express';
import SyncService from '../services/SyncService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../utils/errors.js';

const router = express.Router();

/**
 * POST /api/sync/pull
 * Pull delta changes from central database since given timestamp
 */
router.post(
  '/pull',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sinceTimestamp } = req.body;
    const result = await SyncService.pullUpdates(sinceTimestamp);

    res.json({
      success: true,
      message: 'Delta updates retrieved',
      data: result,
    });
  })
);

/**
 * POST /api/sync/push
 * Push queued offline changes from client (Admin or POS)
 */
router.post(
  '/push',
  authenticate,
  asyncHandler(async (req, res) => {
    const { deviceId, payload } = req.body;

    if (!payload) {
      throw new ValidationError('Payload is required for sync push');
    }

    const result = await SyncService.pushUpdates(deviceId || req.user.id, { ...payload, userId: req.user.id });

    res.json({
      success: true,
      message: 'Changes synced successfully',
      data: result,
    });
  })
);

/**
 * GET /api/sync/logs
 * Get synchronization audit logs (Admin only)
 */
router.get(
  '/logs',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const result = await SyncService.getSyncLogs(parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
