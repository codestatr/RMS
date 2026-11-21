import express from 'express'
import UserService from '../services/UserService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'
import { uploadPropertyImage } from '../middleware/propertyImageUpload.js'
import { query } from '../database/db.js'

const router = express.Router()

async function rejectOwnerManagedTarget(userId, actorRole) {
  if (actorRole === 'property_owner') return
  const [assignment] = await query('SELECT owner_id FROM owner_staff_assignments WHERE staff_id = ?', [userId])
  if (assignment) throw new ValidationError('Only the assigned property owner can deactivate or reactivate this account')
}

/**
 * POST /api/users
 * Create an administrator or cashier account (admin only)
 */
router.post(
  '/',
  authenticate,
  requireRole('admin', 'property_owner'),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone, role } = req.body
    const result = await UserService.register({ email, password, firstName, lastName, phone, role })

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      data: result,
    })
  })
)

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'property_owner'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, status } = req.query

    const result = await UserService.getAllUsers(page, limit, role, status)

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    })
  })
)

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.user.id)

    res.json({
      success: true,
      message: 'Current user profile retrieved',
      data: user,
    })
  })
)

router.put(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await UserService.updateProfile(req.user.id, req.body || {})
    res.json({ success: true, message: 'Profile updated successfully', data: result })
  })
)

router.post(
  '/me/avatar',
  authenticate,
  uploadPropertyImage,
  asyncHandler(async (req, res) => {
    const imageUrl = req.file?.path || ''
    if (!imageUrl) throw new ValidationError('Choose a profile photo to upload')
    const result = await UserService.updateProfile(req.user.id, { profileImageUrl: imageUrl })
    res.json({ success: true, message: 'Profile photo updated successfully', data: result })
  })
)

/**
 * GET /api/users/:id
 * Get user profile
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.params.id)

    res.json({
      success: true,
      message: 'User profile retrieved',
      data: user,
    })
  })
)

/**
 * PUT /api/users/:id
 * Update user profile
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    // Users can only update their own profile, admins can update anyone
    if (req.user.id !== req.params.id && !['admin', 'property_owner'].includes(req.user.role)) {
      throw new ValidationError('You can only update your own profile')
    }

    const result = await UserService.updateProfile(req.params.id, req.body)

    res.json({
      success: true,
      message: 'User profile updated successfully',
      data: result,
    })
  })
)

/**
 * POST /api/users/:id/deactivate
 * Deactivate user account
 */
router.post(
  '/:id/deactivate',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'property_owner') throw new ValidationError('Only a property owner can deactivate accounts')
    if (req.params.id === req.user.id) throw new ValidationError('You cannot deactivate your own property-owner account')

    const result = await UserService.deactivateUser(req.params.id)
    await query("UPDATE owner_staff_assignments SET status = 'inactive' WHERE staff_id = ?", [req.params.id])

    res.json({
      success: true,
      message: result.message,
    })
  })
)

/**
 * POST /api/users/:id/suspend
 * Suspend user (admin only)
 */
router.post(
  '/:id/suspend',
  authenticate,
  requireRole('admin', 'property_owner'),
  asyncHandler(async (req, res) => {
    await rejectOwnerManagedTarget(req.params.id, req.user.role)
    const result = await UserService.suspendUser(req.params.id)

    res.json({
      success: true,
      message: result.message,
    })
  })
)

/**
 * POST /api/users/:id/reactivate
 * Reactivate user (admin only)
 */
router.post(
  '/:id/reactivate',
  authenticate,
  requireRole('admin', 'property_owner'),
  asyncHandler(async (req, res) => {
    await rejectOwnerManagedTarget(req.params.id, req.user.role)
    const result = await UserService.reactivateUser(req.params.id)
    if (req.user.role === 'property_owner') {
      await query("UPDATE owner_staff_assignments SET status = 'active' WHERE staff_id = ?", [req.params.id])
    }

    res.json({
      success: true,
      message: result.message,
    })
  })
)

/**
 * DELETE /api/users/:id
 * Delete user account
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'property_owner'),
  asyncHandler(async (req, res) => {
    await rejectOwnerManagedTarget(req.params.id, req.user.role)
    const result = await UserService.deactivateUser(req.params.id)

    res.status(204).json({
      success: true,
      message: result.message,
    })
  })
)

export default router
