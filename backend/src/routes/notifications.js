import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler, ValidationError } from '../utils/errors.js'
import { query } from '../database/db.js'

const router = express.Router()

router.get('/', authenticate, requireRole('admin', 'cashier'), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT n.*, CONCAT(sender.first_name, ' ', sender.last_name) AS sender_name
     FROM notifications n LEFT JOIN users sender ON sender.id = n.sender_id
     WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT 50`,
    [req.user.id]
  )
  res.json({ success: true, data: rows })
}))

router.patch('/:id/read', authenticate, requireRole('admin', 'cashier'), asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id])
  res.json({ success: true })
}))

router.post('/staff', authenticate, requireRole('admin', 'cashier'), asyncHandler(async (req, res) => {
  const { recipientId, recipientRole, recipientEmail, title, message, type = 'staff_message' } = req.body || {}
  const cleanedTitle = String(title || '').trim()
  const cleanedMessage = String(message || '').trim()
  const cleanedEmail = String(recipientEmail || '').trim()

  if ((!recipientId && !recipientRole && !cleanedEmail) || !cleanedTitle || !cleanedMessage) {
    throw new ValidationError('recipientId, recipientEmail, or recipientRole, title, and message are required')
  }

  let recipients = []
  if (recipientId) {
    recipients = await query('SELECT id FROM users WHERE id = ? AND role IN (\'admin\', \'cashier\') AND status = \'active\'', [recipientId])
  } else if (cleanedEmail) {
    recipients = await query('SELECT id FROM users WHERE email = ? AND role IN (\'admin\', \'cashier\') AND status = \'active\'', [cleanedEmail])
  } else {
    recipients = await query('SELECT id FROM users WHERE role = ? AND status = \'active\'', [recipientRole])
  }

  if (!recipients.length) {
    const fallbackCashierEmail = 'cashier@rms.com'
    const fallbackRecipient = await query('SELECT id FROM users WHERE email = ? AND status = \'active\'', [req.user?.role === 'cashier' ? req.user.email || fallbackCashierEmail : fallbackCashierEmail])
    if (!fallbackRecipient.length) {
      throw new ValidationError('No active staff recipient found')
    }
    recipients = fallbackRecipient
  }

  for (const recipient of recipients) {
    await query(
      'INSERT INTO notifications (id, recipient_id, sender_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), recipient.id, req.user.id, cleanedTitle, cleanedMessage, type]
    )
  }

  res.status(201).json({ success: true, data: { sent: recipients.length } })
}))

export default router
