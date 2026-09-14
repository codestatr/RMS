import express from 'express'
import UserService from '../services/UserService.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler, ApiError, ValidationError, UnauthorizedError } from '../utils/errors.js'
import { verifyRefreshToken, generateToken, verifyToken } from '../utils/auth.js'

const router = express.Router()

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body

    const result = await UserService.register({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: 'customer',
    })

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    })
  })
)

/**
 * POST /api/auth/login
 * Login user with email and password
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, client = 'web' } = req.body

    if (!email || !password) {
      throw new ValidationError('Email and password are required')
    }

    const result = await UserService.login(email, password, client)

    res.json({
      success: true,
      message: result.requires2FA ? 'OTP required' : 'Login successful',
      data: result,
    })
  })
)

/**
 * POST /api/auth/verify-otp
 * Verify 2FA OTP
 */
router.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { tempToken, otp } = req.body

    if (!tempToken || !otp) {
      throw new ValidationError('Temporary token and OTP are required')
    }

    try {
      // Verify temp token
      const decoded = verifyToken(tempToken)
      
      if (!decoded.requires2FA) {
        throw new UnauthorizedError('Invalid token type')
      }

      const result = await UserService.verifyOtp(decoded.id, otp)

      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      })
    } catch (error) {
      throw new UnauthorizedError('Invalid token or OTP')
    }
  })
)

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body

    if (!refreshToken) {
      throw new ApiError(401, 'Refresh token is required')
    }

    const decoded = verifyRefreshToken(refreshToken)
    const user = await UserService.getUserById(decoded.id)

    const newToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {
        token: newToken,
        expiresIn: 86400,
      },
    })
  })
)

/**
 * POST /api/auth/logout
 * Logout user (client-side token deletion)
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // Token is deleted client-side
    // This endpoint can be used for logging logout events
    res.json({
      success: true,
      message: 'Logout successful',
    })
  })
)

/**
 * POST /api/auth/verify
 * Verify JWT token validity
 */
router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { token } = req.body

    if (!token) {
      throw new ValidationError('Token is required')
    }

    try {
      const decoded = verifyToken(token)
      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          valid: true,
          user: decoded,
        },
      })
    } catch (error) {
      res.json({
        success: false,
        message: 'Invalid or expired token',
        data: {
          valid: false,
        },
      })
    }
  })
)

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current and new passwords are required')
    }

    const result = await UserService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    )

    res.json({
      success: true,
      message: result.message,
    })
  })
)

export default router
