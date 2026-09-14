/**
 * Validation utility functions
 */

export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export function validatePhone(phone) {
  // Supports various formats: +254712345678, 0712345678, 254712345678
  const regex = /^(\+?\d{1,3})?[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}$/
  return regex.test(phone)
}

export function validatePassword(password) {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  return regex.test(password)
}

export function validateUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return regex.test(uuid)
}

export function validateDate(date) {
  return !isNaN(Date.parse(date))
}

export function validateDecimal(value, maxDigits = 10, maxDecimals = 2) {
  const regex = new RegExp(`^\\d{1,${maxDigits - maxDecimals}}(\\.\\d{1,${maxDecimals}})?$`)
  return regex.test(value.toString())
}

export function validatePropertyType(type) {
  const validTypes = ['one_bedroom', 'airbnb', 'single_room', 'bedsitter', 'bnb']
  return validTypes.includes(type)
}

export function validateBookingStatus(status) {
  const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']
  return validStatuses.includes(status)
}

export function validatePaymentMethod(method) {
  const validMethods = ['card', 'mpesa', 'paypal', 'bank_transfer', 'cash']
  return validMethods.includes(method)
}

export function validatePaymentStatus(status) {
  const validStatuses = ['pending', 'paid', 'partially_paid', 'refunded', 'failed']
  return validStatuses.includes(status)
}

export function validateUserRole(role) {
  const validRoles = ['customer', 'admin', 'cashier']
  return validRoles.includes(role)
}

export function validateUserStatus(status) {
  const validStatuses = ['active', 'inactive', 'suspended']
  return validStatuses.includes(status)
}

export function sanitizeString(str) {
  if (typeof str !== 'string') return str
  return str.trim().replaceAll('<', '').replaceAll('>', '')
}

export function sanitizeInput(obj) {
  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Validate object schema
 */
export function validateSchema(obj, schema) {
  const errors = {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field]

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} is required`
      continue
    }

    // Skip validation if not required and no value
    if (!rules.required && !value) continue

    // Check type
    if (rules.type) {
      const actualType = typeof value
      if (actualType !== rules.type) {
        errors[field] = `${field} must be of type ${rules.type}`
      }
    }

    // Check pattern
    if (rules.pattern && !rules.pattern.test(value)) {
      errors[field] = rules.patternMessage || `${field} format is invalid`
    }

    // Check custom validator
    if (rules.validator && !rules.validator(value)) {
      errors[field] = rules.validatorMessage || `${field} validation failed`
    }

    // Check min length
    if (rules.minLength && value.length < rules.minLength) {
      errors[field] = `${field} must be at least ${rules.minLength} characters`
    }

    // Check max length
    if (rules.maxLength && value.length > rules.maxLength) {
      errors[field] = `${field} must not exceed ${rules.maxLength} characters`
    }

    // Check min value
    if (rules.min !== undefined && value < rules.min) {
      errors[field] = `${field} must be at least ${rules.min}`
    }

    // Check max value
    if (rules.max !== undefined && value > rules.max) {
      errors[field] = `${field} must not exceed ${rules.max}`
    }

    // Check allowed values
    if (rules.enum && !rules.enum.includes(value)) {
      errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export default {
  validateEmail,
  validatePhone,
  validatePassword,
  validateUUID,
  validateDate,
  validateDecimal,
  validatePropertyType,
  validateBookingStatus,
  validatePaymentMethod,
  validatePaymentStatus,
  validateUserRole,
  validateUserStatus,
  sanitizeString,
  sanitizeInput,
  validateSchema,
}
