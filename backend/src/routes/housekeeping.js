import express from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../utils/errors.js'
import HousekeepingService from '../services/HousekeepingService.js'

const router = express.Router()
router.use(authenticate, requireRole('admin', 'cashier', 'housekeeping'))

router.get('/workboard', asyncHandler(async (req, res) => {
  const data = await HousekeepingService.getWorkboard(req.user)
  res.json({ success: true, data })
}))

router.post('/tasks', asyncHandler(async (req, res) => {
  const data = await HousekeepingService.createTask(req.body || {}, req.user.id)
  res.status(201).json({ success: true, message: 'Housekeeping task created', data })
}))

router.patch('/tasks/:id', asyncHandler(async (req, res) => {
  const data = await HousekeepingService.updateTask(req.params.id, req.body || {}, req.user)
  res.json({ success: true, message: 'Housekeeping task updated', data })
}))

export default router
