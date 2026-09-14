import { v4 as uuidv4 } from 'uuid'
import { query } from '../database/db.js'
import {
  ValidationError,
  NotFoundError,
} from '../utils/errors.js'
import {
  validatePropertyType,
  validateDecimal,
  sanitizeInput,
} from '../utils/validation.js'

class PropertyService {
  getDefaultPropertyImage(type) {
    const images = {
      airbnb: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
      one_bedroom: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
      single_room: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200',
      bedsitter: 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=1200',
      bnb: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
    }
    return images[type] || images.airbnb
  }

  /**
   * Get all properties with filtering
   */
  async getAllProperties(filters = {}, page = 1, limit = 20) {
    const {
      type,
      city,
      minPrice,
      maxPrice,
      rating,
      search,
    } = filters

    let whereClause = 'WHERE p.status = "available"'
    const params = []

    if (type) {
      whereClause += ' AND p.type = ?'
      params.push(type)
    }

    if (city) {
      whereClause += ' AND p.city = ?'
      params.push(city)
    }

    if (minPrice) {
      whereClause += ' AND p.price_per_night >= ?'
      params.push(minPrice)
    }

    if (maxPrice) {
      whereClause += ' AND p.price_per_night <= ?'
      params.push(maxPrice)
    }

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.address LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    const offset = (page - 1) * limit

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM properties p ${whereClause}`,
      params
    )
    const total = countResult[0].total

    // Get properties
    const properties = await query(
      `SELECT p.*, 
              AVG(r.rating) as avg_rating,
              COUNT(DISTINCT r.id) as review_count
       FROM properties p
       LEFT JOIN reviews r ON p.id = r.property_id AND r.status = 'approved'
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    // Apply rating filter if specified
    let filtered = properties
    if (rating) {
      filtered = properties.filter(p => (p.avg_rating || 0) >= rating)
    }

    const propertyIds = filtered.map((property) => property.id)
    const imageRows = propertyIds.length
      ? await query(
        `SELECT property_id, image_url
         FROM property_images
         WHERE property_id IN (${propertyIds.map(() => '?').join(',')})
         ORDER BY display_order`,
        propertyIds
      )
      : []
    const imagesByProperty = new Map()
    for (const image of imageRows) {
      const images = imagesByProperty.get(image.property_id) || []
      images.push(image.image_url)
      imagesByProperty.set(image.property_id, images)
    }

    return {
      data: filtered.map((property) => this.formatProperty({
        ...property,
        images: imagesByProperty.get(property.id) || [],
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get property by ID
   */
  async getPropertyById(propertyId) {
    const properties = await query(
      `SELECT p.*,
              AVG(r.rating) as avg_rating,
              COUNT(DISTINCT r.id) as review_count
       FROM properties p
       LEFT JOIN reviews r ON p.id = r.property_id AND r.status = 'approved'
       WHERE p.id = ?
       GROUP BY p.id`,
      [propertyId]
    )

    if (properties.length === 0) {
      throw new NotFoundError('Property')
    }

    const property = properties[0]

    // Get images
    const images = await query(
      'SELECT id, image_url, is_cover, display_order FROM property_images WHERE property_id = ? ORDER BY display_order',
      [propertyId]
    )

    // Get amenities
    const amenities = await query(
      `SELECT a.id, a.name, a.icon 
       FROM amenities a
       JOIN property_amenities pa ON a.id = pa.amenity_id
       WHERE pa.property_id = ?`,
      [propertyId]
    )

    // Get reviews
    const reviews = await query(
          `SELECT r.id, r.rating, r.title, r.comment, r.created_at,
            u.first_name, u.last_name
           FROM reviews r
           JOIN users u ON r.customer_id = u.id
           WHERE r.property_id = ? AND r.status = 'approved'
           ORDER BY r.created_at DESC
       LIMIT 10`,
      [propertyId]
    )

    return {
      ...this.formatProperty(property),
      images: images.length
        ? images.map((image) => image.image_url)
        : this.formatProperty(property).images,
      amenities,
      reviews,
    }
  }

  /**
   * Create property
   */
  async createProperty(ownerId, data) {
    const {
      name,
      type,
      description,
      address,
      city,
      country,
      latitude,
      longitude,
      pricePerNight,
      pricePerWeek,
      pricePerMonth,
      capacity,
      bedrooms,
      bathrooms,
      imageUrl,
    } = sanitizeInput(data)

    // Validate input
    if (!name || !type || !address || !city) {
      throw new ValidationError('Missing required fields')
    }

    if (!validatePropertyType(type)) {
      throw new ValidationError('Invalid property type')
    }

    if (!validateDecimal(pricePerNight, 10, 2)) {
      throw new ValidationError('Invalid price format')
    }

    const propertyId = uuidv4()

    await query(
      `INSERT INTO properties (
        id, owner_id, name, type, description, address, city, country,
        latitude, longitude, price_per_night, price_per_week, price_per_month,
        capacity, bedrooms, bathrooms, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', NOW(), NOW())`,
      [
        propertyId, ownerId, name, type, description, address, city, country || 'Kenya',
        latitude || null, longitude || null, pricePerNight, pricePerWeek || null,
        pricePerMonth || null, capacity || 1, bedrooms || null, bathrooms || null,
      ]
    )

    if (imageUrl) {
      await this.addImage(propertyId, imageUrl, true, 0)
    }

    return this.getPropertyById(propertyId)
  }

  /**
   * Update property
   */
  async updateProperty(propertyId, ownerId, data) {
    const sanitized = sanitizeInput(data)

    // Check ownership
    const properties = await query(
      'SELECT owner_id FROM properties WHERE id = ?',
      [propertyId]
    )

    if (properties.length === 0) {
      throw new NotFoundError('Property')
    }

    if (properties[0].owner_id !== ownerId) {
      throw new ValidationError('You do not have permission to update this property')
    }

    const {
      name,
      type,
      description,
      address,
      city,
      country,
      pricePerNight,
      capacity,
      bedrooms,
      bathrooms,
      status,
    } = sanitized

    await query(
      `UPDATE properties SET
       name = COALESCE(?, name),
       type = COALESCE(?, type),
       description = COALESCE(?, description),
       address = COALESCE(?, address),
       city = COALESCE(?, city),
       country = COALESCE(?, country),
       price_per_night = COALESCE(?, price_per_night),
       capacity = COALESCE(?, capacity),
       bedrooms = COALESCE(?, bedrooms),
       bathrooms = COALESCE(?, bathrooms),
       status = COALESCE(?, status),
       updated_at = NOW()
       WHERE id = ?`,
      [
        name, type, description, address, city, country, pricePerNight,
        capacity, bedrooms, bathrooms, status, propertyId,
      ]
    )

    if (sanitized.imageUrl) {
      await query('DELETE FROM property_images WHERE property_id = ?', [propertyId])
      await this.addImage(propertyId, sanitized.imageUrl, true, 0)
    }

    return this.getPropertyById(propertyId)
  }

  /**
   * Delete property
   */
  async deleteProperty(propertyId, ownerId) {
    // Check ownership
    const properties = await query(
      'SELECT owner_id FROM properties WHERE id = ?',
      [propertyId]
    )

    if (properties.length === 0) {
      throw new NotFoundError('Property')
    }

    if (properties[0].owner_id !== ownerId) {
      throw new ValidationError('You do not have permission to delete this property')
    }

    await query('DELETE FROM properties WHERE id = ?', [propertyId])
    return { message: 'Property deleted successfully' }
  }

  /**
   * Add property image
   */
  async addImage(propertyId, imageUrl, isCover = false, displayOrder = 0) {
    const imageId = uuidv4()

    // If this is cover image, remove cover from others
    if (isCover) {
      await query(
        'UPDATE property_images SET is_cover = FALSE WHERE property_id = ?',
        [propertyId]
      )
    }

    await query(
      `INSERT INTO property_images (id, property_id, image_url, is_cover, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [imageId, propertyId, imageUrl, isCover, displayOrder]
    )

    return { id: imageId, imageUrl, isCover, displayOrder }
  }

  /**
   * Check property availability
   */
  async checkAvailability(propertyId, checkInDate, checkOutDate) {
    const bookings = await query(
      `SELECT check_in_date, check_out_date FROM bookings
       WHERE property_id = ? 
       AND status IN ('confirmed', 'checked_in')
       AND check_in_date < ?
       AND check_out_date > ?`,
      [propertyId, checkOutDate, checkInDate]
    )

    const isAvailable = bookings.length === 0

    return {
      isAvailable,
      conflictingBookings: bookings,
    }
  }

  async updateHousekeepingStatus(propertyId, housekeepingStatus) {
    const allowedStatuses = ['clean', 'dirty', 'maintenance']
    if (!allowedStatuses.includes(housekeepingStatus)) {
      throw new ValidationError('Invalid housekeeping status')
    }

    const properties = await query('SELECT id FROM properties WHERE id = ?', [propertyId])
    if (properties.length === 0) {
      throw new NotFoundError('Property')
    }

    await query(
      'UPDATE properties SET housekeeping_status = ?, updated_at = NOW() WHERE id = ?',
      [housekeepingStatus, propertyId]
    )

    return this.getPropertyById(propertyId)
  }

  /**
   * Get properties by owner
   */
  async getPropertiesByOwner(ownerId, page = 1, limit = 20) {
    const offset = (page - 1) * limit

    const countResult = await query(
      'SELECT COUNT(*) as total FROM properties WHERE owner_id = ?',
      [ownerId]
    )
    const total = countResult[0].total

    const properties = await query(
      `SELECT p.*, 
              AVG(r.rating) as avg_rating,
              COUNT(DISTINCT r.id) as review_count
       FROM properties p
       LEFT JOIN reviews r ON p.id = r.property_id AND r.status = 'approved'
       WHERE p.owner_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [ownerId, limit, offset]
    )

    return {
      data: properties.map((property) => this.formatProperty(property)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Format property object
   */
  formatProperty(property) {
    const imageUrls = [
      ...(property.images
        ? (Array.isArray(property.images) ? property.images : String(property.images).split('||')).filter(Boolean)
        : []),
      ...(property.image_url ? [property.image_url] : []),
    ].filter((image, index, values) => values.indexOf(image) === index)

    return {
      id: property.id,
      ownerId: property.owner_id,
      name: property.name,
      type: property.type,
      description: property.description,
      address: property.address,
      city: property.city,
      country: property.country,
      latitude: property.latitude,
      longitude: property.longitude,
      pricePerNight: property.price_per_night,
      pricePerWeek: property.price_per_week,
      pricePerMonth: property.price_per_month,
      capacity: property.capacity,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      status: property.status,
      housekeepingStatus: property.housekeeping_status || 'clean',
      rating: property.avg_rating ? parseFloat(property.avg_rating).toFixed(1) : 0,
      reviewCount: property.review_count || 0,
      images: imageUrls.length ? imageUrls : [this.getDefaultPropertyImage(property.type)],
      createdAt: property.created_at,
      updatedAt: property.updated_at,
    }
  }
}

export default new PropertyService()
