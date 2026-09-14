/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(statusCode = 500, message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.timestamp = new Date().toISOString()
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApiError {
  constructor(message, errors = {}) {
    super(400, message, 'VALIDATION_ERROR')
    this.errors = errors
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND')
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED')
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN')
  }
}

/**
 * Conflict error
 */
export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(409, message, 'CONFLICT')
  }
}

/**
 * Error handling middleware
 */
export function errorHandler(err, req, res, next) {
  console.error('Error:', {
    message: err.message,
    statusCode: err.statusCode || 500,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.errors && { errors: err.errors }),
      timestamp: err.timestamp,
    })
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.errors,
      timestamp: new Date().toISOString(),
    })
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
      timestamp: new Date().toISOString(),
    })
  }

  if (err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference to related resource',
      code: 'INVALID_REFERENCE',
      timestamp: new Date().toISOString(),
    })
  }

  // Generic error response
  const statusCode = err.statusCode || 500
  const isDevelopment = process.env.NODE_ENV === 'development'

  res.status(statusCode).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  })
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export default {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  asyncHandler,
}
