import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { query } from '../database/db.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { limit = 50, entityType } = req.query;
    const params = [];
    let where = '';
    if (entityType) {
      where = 'WHERE a.entity_type = ?';
      params.push(entityType);
    }

    const logs = await query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${where}
       ORDER BY a.timestamp DESC
       LIMIT ?`,
      [...params, Math.min(Number(limit) || 50, 200)]
    );

    res.json({
      success: true,
      data: logs.map((log) => ({
        ...log,
        userName: `${log.first_name || ''} ${log.last_name || ''}`.trim() || log.email || 'System',
      })),
    });
  })
);

export default router;
