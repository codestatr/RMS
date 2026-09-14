import { verifyToken } from '../utils/auth.js'
import { ApiError } from '../utils/errors.js'

/**
 * Authenticate user and attach to request
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No authentication token provided')
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)

    req.user = decoded
    next()
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: 'UNAUTHORIZED',
      })
    }

    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    })
  }
}

/**
 * Require specific role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      })
    }

    next()
  }
}

/**
 * Verify user is active
 */
export async function verifyUserActive(req, res, next) {
  try {
    if (req.user && req.user.status !== 'active') {
      throw new ApiError(403, 'Your account has been suspended or deactivated')
    }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Optional authentication (doesn't throw if no token)
 */
export function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      req.user = verifyToken(token)
    }

    next()
  } catch (error) {
    // Silently fail - proceed without user
    next()
  }
}

export default {
  authenticate,
  requireRole,
  verifyUserActive,
  optionalAuthenticate,
}
