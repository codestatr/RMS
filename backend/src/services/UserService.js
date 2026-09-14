import { v4 as uuidv4 } from 'uuid'
import { query, transaction } from '../database/db.js'
import { hashPassword, comparePassword, generateToken, generateRefreshToken } from '../utils/auth.js'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../utils/errors.js'
import {
  validateEmail,
  validatePassword,
  validatePhone,
  validateUserRole,
  sanitizeInput,
} from '../utils/validation.js'
import NotificationService from './NotificationService.js'

class UserService {
  /**
   * Register new user
   */
  async register(data) {
    const { email, password, firstName, lastName, phone, role = 'customer' } = data

    // Validate input
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format')
    }

    if (!validatePassword(password)) {
      throw new ValidationError(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      )
    }

    if (phone && !validatePhone(phone)) {
      throw new ValidationError('Invalid phone number format')
    }

    if (!validateUserRole(role)) {
      throw new ValidationError('Invalid user role')
    }

    // Check if email exists
    const existing = await query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) {
      throw new ConflictError('Email already registered')
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const userId = uuidv4()
    await query(
      `INSERT INTO users (id, email, first_name, last_name, phone, role, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [userId, email, firstName, lastName, phone || null, role, passwordHash]
    )

    return this.getUserById(userId)
  }

  /**
   * Login user
   */
  async login(email, password, client = 'web') {
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format')
    }

    // Find user
    const users = await query(
      `SELECT id, email, password_hash, role, status, first_name, last_name, two_factor_enabled 
       FROM users WHERE email = ?`,
      [email]
    )

    if (users.length === 0) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const user = users[0]

    // Check status
    if (user.status !== 'active') {
      throw new UnauthorizedError('Your account has been suspended')
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash)
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password')
    }

    if (client === 'web' && ['admin', 'cashier'].includes(user.role)) {
      throw new UnauthorizedError('Staff accounts must sign in through the POS application')
    }

    // Check 2FA
    if (user.two_factor_enabled) {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      // Set expiration to 10 minutes from now
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      await query('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?', [
        otp,
        expiresAt,
        user.id,
      ])

      // Send OTP via email
      await NotificationService.sendOTP(user.email, user.first_name, otp)

      // Generate a temporary token that can only be used for OTP verification
      const tempToken = generateToken({
        id: user.id,
        email: user.email,
        requires2FA: true,
      }, '15m')

      return {
        requires2FA: true,
        tempToken,
        message: 'OTP sent to your email'
      }
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    })

    return {
      requires2FA: false,
      token,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    }
  }

  /**
   * Verify OTP for 2FA
   */
  async verifyOtp(userId, otp) {
    const users = await query(
      `SELECT id, email, role, first_name, last_name, otp_code, otp_expires_at 
       FROM users WHERE id = ?`,
      [userId]
    )

    if (users.length === 0) {
      throw new UnauthorizedError('User not found')
    }

    const user = users[0]

    if (user.otp_code !== otp) {
      throw new UnauthorizedError('Invalid OTP code')
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      throw new UnauthorizedError('OTP code has expired')
    }

    // Clear OTP and update last login
    await query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL, last_login = NOW() WHERE id = ?', [user.id])

    // Generate real tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    })

    return {
      token,
      refreshToken,
      expiresIn: 86400,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const users = await query(
      `SELECT id, email, first_name, last_name, phone, role, status, 
              profile_image_url, address, city, country, two_factor_enabled, 
              created_at, updated_at
       FROM users WHERE id = ?`,
      [userId]
    )

    if (users.length === 0) {
      throw new NotFoundError('User')
    }

    return this.formatUser(users[0])
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const users = await query('SELECT id FROM users WHERE email = ?', [email])

    if (users.length === 0) {
      throw new NotFoundError('User')
    }

    return this.getUserById(users[0].id)
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, data) {
    const sanitized = sanitizeInput(data)
    const { firstName, lastName, phone, address, city, country } = sanitized

    // Validate phone if provided
    if (phone && !validatePhone(phone)) {
      throw new ValidationError('Invalid phone number format')
    }

    await query(
      `UPDATE users 
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           country = COALESCE(?, country),
           updated_at = NOW()
       WHERE id = ?`,
      [firstName, lastName, phone, address, city, country, userId]
    )

    return this.getUserById(userId)
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    if (!validatePassword(newPassword)) {
      throw new ValidationError(
        'New password must be at least 8 characters with uppercase, lowercase, number, and special character'
      )
    }

    // Get current password hash
    const users = await query('SELECT password_hash FROM users WHERE id = ?', [userId])

    if (users.length === 0) {
      throw new NotFoundError('User')
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, users[0].password_hash)
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect')
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword)
    await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
      newHash,
      userId,
    ])

    return { message: 'Password changed successfully' }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(page = 1, limit = 20, role = null, status = null) {
    let whereClause = 'WHERE 1=1'
    const params = []

    if (role) {
      whereClause += ' AND role = ?'
      params.push(role)
    }

    if (status) {
      whereClause += ' AND status = ?'
      params.push(status)
    }

    const offset = (page - 1) * limit

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    )
    const total = countResult[0].total

    // Get users
    const users = await query(
      `SELECT id, email, first_name, last_name, phone, role, status, 
              profile_image_url, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      data: users.map((user) => this.formatUser(user)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId) {
    await query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [
      'inactive',
      userId,
    ])
    return { message: 'User account deactivated' }
  }

  /**
   * Suspend user (admin action)
   */
  async suspendUser(userId) {
    await query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [
      'suspended',
      userId,
    ])
    return { message: 'User account suspended' }
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId) {
    await query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [
      'active',
      userId,
    ])
    return { message: 'User account reactivated' }
  }

  /**
   * Format user object (remove sensitive data)
   */
  formatUser(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profileImageUrl: user.profile_image_url,
      address: user.address,
      city: user.city,
      country: user.country,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }
}

export default new UserService()
