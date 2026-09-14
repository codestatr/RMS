import express from 'express';
import ReviewService from '../services/ReviewService.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 50 } = req.query;
    const result = await ReviewService.getAllReviews(status, parseInt(page), parseInt(limit));
    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/reviews/property/:propertyId
 * Get reviews for a property
 */
router.get(
  '/property/:propertyId',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await ReviewService.getPropertyReviews(
      req.params.propertyId,
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
 * POST /api/reviews
 * Submit a review for a property
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await ReviewService.createReview(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: result,
    });
  })
);

/**
 * PATCH /api/reviews/:id/moderate
 * Moderate review status (Admin only)
 */
router.patch(
  '/:id/moderate',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const result = await ReviewService.moderateReview(req.params.id, status);

    res.json({
      success: true,
      message: `Review status updated to ${status}`,
      data: result,
    });
  })
);

export default router;
