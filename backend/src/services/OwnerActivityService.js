import { v4 as uuidv4 } from 'uuid'
import { query } from '../database/db.js'
import { verifyToken } from '../utils/auth.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function resolvePropertyId(path, body = {}) {
  const supplied = body.propertyId || body.property_id
  if (supplied && UUID_PATTERN.test(String(supplied))) return String(supplied)

  const parts = path.split('/').filter(Boolean)
  const candidate = parts.find((part) => UUID_PATTERN.test(part))
  if (!candidate) return null

  const propertyIndex = parts.indexOf('properties')
  const bookingIndex = parts.indexOf('bookings')
  const paymentIndex = parts.indexOf('payments')
  const housekeepingIndex = parts.indexOf('housekeeping')
  if (propertyIndex >= 0) return parts[propertyIndex + 1] && UUID_PATTERN.test(parts[propertyIndex + 1]) ? parts[propertyIndex + 1] : candidate
  if (bookingIndex >= 0) {
    const bookingId = parts[bookingIndex + 1]
    if (!bookingId || !UUID_PATTERN.test(bookingId)) return null
    const [booking] = await query('SELECT property_id FROM bookings WHERE id = ?', [bookingId])
    return booking?.property_id || null
  }
  if (paymentIndex >= 0) {
    const paymentId = parts[paymentIndex + 1]
    if (!paymentId || !UUID_PATTERN.test(paymentId)) return null
    const [payment] = await query(`SELECT b.property_id FROM payments pay
      JOIN bookings b ON b.id = pay.booking_id WHERE pay.id = ?`, [paymentId])
    return payment?.property_id || null
  }
  if (housekeepingIndex >= 0) {
    const taskId = parts[housekeepingIndex + 2] && UUID_PATTERN.test(parts[housekeepingIndex + 2]) ? parts[housekeepingIndex + 2] : candidate
    const [task] = await query('SELECT property_id FROM housekeeping_tasks WHERE id = ?', [taskId])
    return task?.property_id || null
  }
  return null
}

export async function recordOwnerActivity({ userId, role, path, method, body = {} }) {
  if (!userId) return
  // Every owner account has system-wide visibility, so one shared audit event
  // gives every owner a complete feed without duplicating rows per owner.
  const owners = await query(`SELECT id AS owner_id FROM users
    WHERE role = 'property_owner' ORDER BY (status = 'active') DESC, id LIMIT 1`)
  if (!owners.length) return

  let propertyId = null
  try {
    propertyId = await resolvePropertyId(path, body)
  } catch {
    // Keep audit logging best-effort so it cannot fail a completed user action.
  }

  const segments = path.split('/').filter(Boolean)
  const entityType = segments[0] ? String(segments[0]).slice(0, 100) : 'account'
  const action = `${String(method || 'GET').toUpperCase()} ${path}`.slice(0, 255)

  for (const { owner_id: ownerId } of owners) {
    const entityId = segments.find((segment) => UUID_PATTERN.test(segment)) || null
    await query(`INSERT INTO owner_activity_events
      (id, owner_id, actor_id, property_id, action, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), ownerId, userId, propertyId, action, entityType, entityId])
  }
}

/** Records successful authenticated writes without storing request payloads or secrets. */
export function captureOwnerActivity(req, res, next) {
  const method = String(req.method || '').toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next()

  let user
  try {
    const header = req.headers.authorization || ''
    if (header.startsWith('Bearer ')) user = verifyToken(header.slice(7))
  } catch {
    return next()
  }
  if (!user?.id || req.path === '/auth/login' || req.path.startsWith('/payments/webhook/')) return next()

  const path = req.path.split('?')[0].slice(0, 255)
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return
    recordOwnerActivity({ userId: user.id, role: user.role, path, method, body: req.body || {} })
      .catch((error) => console.warn('Could not record owner activity:', error.message))
  })
  next()
}

export async function recordOwnerLogin(userId, role) {
  await recordOwnerActivity({ userId, role, path: '/auth/login', method: 'LOGIN' })
}

