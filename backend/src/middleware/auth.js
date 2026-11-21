import { verifyToken } from '../utils/auth.js'
import { ApiError } from '../utils/errors.js'
import { query } from '../database/db.js'

/**
 * Authenticate user and attach to request
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No authentication token provided')
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    const [account] = await query('SELECT role, status FROM users WHERE id = ?', [decoded.id])
    if (!account || account.status !== 'active') throw new ApiError(403, 'Your account has been suspended or deactivated')
    decoded.role = account.role

    if (['cashier', 'housekeeping', 'catering'].includes(decoded.role)) {
      const assignments = await query(`SELECT a.owner_id, a.status, p.property_id, u.role AS current_role, u.status AS account_status
        FROM owner_staff_assignments a
        LEFT JOIN owner_staff_properties p ON p.owner_id = a.owner_id AND p.staff_id = a.staff_id
        JOIN users u ON u.id = a.staff_id
        WHERE a.staff_id = ?`, [decoded.id])
      if (assignments.length) {
        if (assignments[0].account_status !== 'active') throw new ApiError(403, 'Your account has been suspended or deactivated')
        if (!['cashier', 'housekeeping', 'catering'].includes(assignments[0].current_role)) {
          throw new ApiError(403, 'This account no longer has an owner-managed staff role')
        }
        const active = assignments.filter((assignment) => assignment.status === 'active')
        if (!active.length) throw new ApiError(403, 'Your access to this property team has been disabled')
        decoded.role = assignments[0].current_role
        decoded.ownerIds = [...new Set(active.map((assignment) => assignment.owner_id))]
        decoded.propertyIds = [...new Set(active.map((assignment) => assignment.property_id).filter(Boolean))]
        if (!decoded.propertyIds.length) throw new ApiError(403, 'No properties are assigned to your account')
        decoded.ownerScopedStaff = true
      }
    }

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

    // Property owners are the platform-level owners of this deployment. Their
    // global controls are additive; administrators retain all of their current access.
    if (req.user.role !== 'property_owner' && !roles.includes(req.user.role)) {
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
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next()
  req.headers.authorization = authHeader
  authenticate(req, res, (error) => {
    if (error) return next(error)
    if (!req.user) return next()
    next()
  })
}

export default {
  authenticate,
  requireRole,
  verifyUserActive,
  optionalAuthenticate,
}
