import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

class ReviewService {
  /**
   * Submit a review for a property
   */
  async createReview(customerId, data) {
    const { propertyId, bookingId, rating, title, comment } = data;

    if (!propertyId || !bookingId || !rating || !comment) {
      throw new ValidationError('A completed booking, rating, and comment are required');
    }

    const numRating = parseInt(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw new ValidationError('Rating must be an integer between 1 and 5');
    }

    const bookings = await query(
      `SELECT id FROM bookings
       WHERE id = ? AND customer_id = ? AND property_id = ? AND status = 'checked_out'`,
      [bookingId, customerId, propertyId]
    );
    if (bookings.length === 0) {
      throw new ValidationError('Only customers with a completed stay can review this property');
    }

    const existingReviews = await query('SELECT id FROM reviews WHERE booking_id = ?', [bookingId]);
    if (existingReviews.length > 0) {
      throw new ValidationError('This stay has already been reviewed');
    }

    const reviewId = uuidv4();
    await query(
      `INSERT INTO reviews (id, property_id, customer_id, booking_id, rating, title, comment, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
          [reviewId, propertyId, customerId, bookingId, numRating, title || null, comment]
    );

    return this.getReviewById(reviewId);
  }

  /**
   * Get review by ID
   */
  async getReviewById(reviewId) {
    const reviews = await query(
      `SELECT r.*, u.first_name, u.last_name, pr.name as property_name
       FROM reviews r
       JOIN users u ON r.customer_id = u.id
       JOIN properties pr ON r.property_id = pr.id
       WHERE r.id = ?`,
      [reviewId]
    );

    if (reviews.length === 0) {
      throw new NotFoundError('Review');
    }

    return this.formatReview(reviews[0]);
  }

  /**
   * Get approved reviews for a specific property
   */
  async getPropertyReviews(propertyId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM reviews WHERE property_id = ? AND status = "approved"',
      [propertyId]
    );
    const total = countResult?.total || 0;

    const reviews = await query(
      `SELECT r.*, u.first_name, u.last_name, u.profile_image_url
       FROM reviews r
       JOIN users u ON r.customer_id = u.id
       WHERE r.property_id = ? AND r.status = 'approved'
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [propertyId, limit, offset]
    );

    return {
      data: reviews.map((r) => this.formatReview(r)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAllReviews(status = null, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const where = status ? 'WHERE r.status = ?' : '';
    const params = status ? [status, limit, offset] : [limit, offset];
    const reviews = await query(
      `SELECT r.*, u.first_name, u.last_name, pr.name as property_name
       FROM reviews r
       JOIN users u ON r.customer_id = u.id
       JOIN properties pr ON r.property_id = pr.id
       ${where}
       ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    return reviews.map((review) => this.formatReview(review));
  }

  /**
   * Moderate review (Admin only)
   */
  async moderateReview(reviewId, status) {
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      throw new ValidationError('Invalid status for review moderation');
    }

    await query('UPDATE reviews SET status = ?, updated_at = NOW() WHERE id = ?', [status, reviewId]);
    return this.getReviewById(reviewId);
  }

  formatReview(review) {
    return {
      id: review.id,
      propertyId: review.property_id,
      propertyName: review.property_name,
      customerId: review.customer_id,
      customerName: `${review.first_name || ''} ${review.last_name || ''}`.trim() || 'Guest',
      customerAvatar: review.profile_image_url,
      bookingId: review.booking_id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      verifiedStay: Boolean(review.booking_id),
      createdAt: review.created_at,
    };
  }
}

export default new ReviewService();
