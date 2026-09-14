import express from 'express'
import UserService from '../services/UserService.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'

const router = express.Router()

/**
 * POST /api/users
 * Create an administrator or cashier account (admin only)
 */
router.post(
  '/',
  authenticate,
  requireRole('admin'),
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
  requireRole('admin'),
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
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
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
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      throw new ValidationError('You can only deactivate your own account')
    }

    const result = await UserService.deactivateUser(req.params.id)

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
  requireRole('admin'),
  asyncHandler(async (req, res) => {
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
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await UserService.reactivateUser(req.params.id)

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
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await UserService.deactivateUser(req.params.id)

    res.status(204).json({
      success: true,
      message: result.message,
    })
  })
)

export default router
