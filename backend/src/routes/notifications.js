import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'
import { query, transaction } from '../database/db.js'

const router = express.Router()
const INTERNAL_ROLES = ['admin', 'cashier', 'property_owner', 'housekeeping', 'catering']
const INTERNAL_ROLE_SQL = "'admin', 'cashier', 'property_owner', 'housekeeping', 'catering'"

router.get('/', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT n.*, CONCAT(sender.first_name, ' ', sender.last_name) AS sender_name
     FROM notifications n LEFT JOIN users sender ON sender.id = n.sender_id
     WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT 50`,
    [req.user.id]
  )
  res.json({ success: true, data: rows })
}))

router.get('/recipients', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const recipients = await query(
    `SELECT id, first_name, last_name, email, role
     FROM users
     WHERE status = 'active' AND role IN (${INTERNAL_ROLE_SQL}) AND id <> ?
     ORDER BY first_name, last_name, email`,
    [req.user.id]
  )
  res.json({ success: true, data: recipients })
}))

router.patch('/:id/read', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id])
  res.json({ success: true })
}))

router.post('/staff', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { recipientId, recipientRole, recipientEmail, sendToAll, title, message, type = 'staff_message' } = req.body || {}
  const cleanedTitle = String(title || '').trim()
  const cleanedMessage = String(message || '').trim()
  const cleanedEmail = String(recipientEmail || '').trim()

  if ((!sendToAll && !recipientId && !recipientRole && !cleanedEmail) || !cleanedTitle || !cleanedMessage) {
    throw new ValidationError('Choose a recipient and provide a title and message')
  }

  let recipients = []
  if (sendToAll) {
    recipients = await query(
      `SELECT id FROM users WHERE role IN (${INTERNAL_ROLE_SQL}) AND status = 'active' AND id <> ?`,
      [req.user.id]
    )
  } else if (recipientId) {
    recipients = await query(`SELECT id FROM users WHERE id = ? AND role IN (${INTERNAL_ROLE_SQL}) AND status = 'active' AND id <> ?`, [recipientId, req.user.id])
  } else if (cleanedEmail) {
    recipients = await query(`SELECT id FROM users WHERE email = ? AND role IN (${INTERNAL_ROLE_SQL}) AND status = 'active' AND id <> ?`, [cleanedEmail, req.user.id])
  } else {
    if (!INTERNAL_ROLES.includes(recipientRole)) throw new ValidationError('Invalid recipient role')
    recipients = await query(`SELECT id FROM users WHERE role = ? AND status = 'active' AND id <> ?`, [recipientRole, req.user.id])
  }

  if (!recipients.length) {
    throw new ValidationError('No active staff recipient found')
  }

  await transaction(async (connection) => {
    for (const recipient of recipients) {
      await connection.execute(
        'INSERT INTO notifications (id, recipient_id, sender_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), recipient.id, req.user.id, cleanedTitle, cleanedMessage, type]
      )
    }
  })

  res.status(201).json({ success: true, data: { sent: recipients.length } })
}))

export default router
