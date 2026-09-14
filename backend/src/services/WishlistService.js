import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db.js';
import { ValidationError } from '../utils/errors.js';

class WishlistService {
  /**
   * Toggle a property in customer's wishlist
   */
  async toggleWishlist(customerId, propertyId) {
    if (!propertyId) {
      throw new ValidationError('Property ID is required');
    }

    const existing = await query(
      'SELECT id FROM wishlists WHERE customer_id = ? AND property_id = ?',
      [customerId, propertyId]
    );

    if (existing.length > 0) {
      await query('DELETE FROM wishlists WHERE customer_id = ? AND property_id = ?', [
        customerId,
        propertyId,
      ]);
      return { saved: false, message: 'Property removed from wishlist' };
    } else {
      await query(
        'INSERT INTO wishlists (id, customer_id, property_id, created_at) VALUES (?, ?, ?, NOW())',
        [uuidv4(), customerId, propertyId]
      );
      return { saved: true, message: 'Property saved to wishlist' };
    }
  }

  /**
   * Get all wishlist properties for a customer
   */
  async getCustomerWishlist(customerId) {
    const properties = await query(
      `SELECT p.*, w.created_at as saved_at,
              AVG(r.rating) as avg_rating,
              COUNT(DISTINCT r.id) as review_count,
              GROUP_CONCAT(pi.image_url) as images
       FROM wishlists w
       JOIN properties p ON w.property_id = p.id
       LEFT JOIN reviews r ON p.id = r.property_id AND r.status = 'approved'
       LEFT JOIN property_images pi ON p.id = pi.property_id
       WHERE w.customer_id = ?
       GROUP BY p.id
       ORDER BY w.created_at DESC`,
      [customerId]
    );

    return properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      description: p.description,
      address: p.address,
      city: p.city,
      country: p.country,
      pricePerNight: parseFloat(p.price_per_night),
      capacity: p.capacity,
      status: p.status,
      avgRating: p.avg_rating ? parseFloat(p.avg_rating) : 0,
      reviewCount: p.review_count || 0,
      images: p.images ? p.images.split(',') : [],
      savedAt: p.saved_at,
    }));
  }
}

export default new WishlistService();
