import express from 'express';
import WishlistService from '../services/WishlistService.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

/**
 * GET /api/wishlist
 * Get current customer's wishlist
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await WishlistService.getCustomerWishlist(req.user.id);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/wishlist/toggle
 * Add or remove property from wishlist
 */
router.post(
  '/toggle',
  authenticate,
  asyncHandler(async (req, res) => {
    const { propertyId } = req.body;
    const result = await WishlistService.toggleWishlist(req.user.id, propertyId);

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
