import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import PropertyService from '../services/PropertyService.js'
import { query } from '../database/db.js'
import { authenticate, requireRole, optionalAuthenticate } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'

const router = express.Router()

/**
 * GET /api/properties
 * Get all properties with filtering and pagination
 */
router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, city, minPrice, maxPrice, rating, search } = req.query

    const filters = {
      type: type || null,
      city: city || null,
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
      rating: rating || null,
      search: search || null,
    }

    const result = await PropertyService.getAllProperties(filters, page, limit)

    res.json({
      success: true,
      message: 'Properties retrieved successfully',
      data: result,
    })
  })
)

/**
 * POST /api/properties
 * Create a new property (owner or admin)
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'property_owner') {
      throw new ValidationError('Only property owners and admins can create properties')
    }

    const result = await PropertyService.createProperty(req.user.id, req.body)

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: result,
    })
  })
)

/**
 * GET /api/properties/:id
 * Get property details by ID
 */
router.get(
  '/:id',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const result = await PropertyService.getPropertyById(req.params.id)

    res.json({
      success: true,
      message: 'Property retrieved successfully',
      data: result,
    })
  })
)

/**
 * PUT /api/properties/:id
 * Update property
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await PropertyService.updateProperty(
      req.params.id,
      req.user.id,
      req.body
    )

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: result,
    })
  })
)

/**
 * DELETE /api/properties/:id
 * Delete property
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await PropertyService.deleteProperty(req.params.id, req.user.id)

    res.json({
      success: true,
      message: result.message,
    })
  })
)

/**
 * GET /api/properties/:id/availability
 * Check property availability
 */
router.get(
  '/:id/availability',
  asyncHandler(async (req, res) => {
    const { checkInDate, checkOutDate } = req.query

    if (!checkInDate || !checkOutDate) {
      throw new ValidationError('checkInDate and checkOutDate are required')
    }

    const result = await PropertyService.checkAvailability(
      req.params.id,
      checkInDate,
      checkOutDate
    )

    res.json({
      success: true,
      message: 'Availability checked',
      data: result,
    })
  })
)

router.patch(
  '/:id/housekeeping-status',
  authenticate,
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const result = await PropertyService.updateHousekeepingStatus(
      req.params.id,
      req.body?.housekeepingStatus
    )

    await query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), req.user.id, 'housekeeping_status_updated', 'property', req.params.id, JSON.stringify({ housekeepingStatus: req.body?.housekeepingStatus })]
    )

    res.json({
      success: true,
      message: 'Housekeeping status updated',
      data: result,
    })
  })
)

/**
 * POST /api/properties/:id/images
 * Add property image
 */
router.post(
  '/:id/images',
  authenticate,
  asyncHandler(async (req, res) => {
    const { imageUrl, isCover, displayOrder } = req.body

    if (!imageUrl) {
      throw new ValidationError('imageUrl is required')
    }

    const result = await PropertyService.addImage(
      req.params.id,
      imageUrl,
      isCover || false,
      displayOrder || 0
    )

    res.status(201).json({
      success: true,
      message: 'Image added successfully',
      data: result,
    })
  })
)

/**
 * GET /api/properties/owner/:ownerId
 * Get properties by owner
 */
router.get(
  '/owner/:ownerId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query

    const result = await PropertyService.getPropertiesByOwner(
      req.params.ownerId,
      page,
      limit
    )

    res.json({
      success: true,
      message: 'Properties retrieved successfully',
      data: result,
    })
  })
)

export default router
