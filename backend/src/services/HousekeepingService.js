import { v4 as uuidv4 } from 'uuid'
import { query } from '../database/db.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'

class HousekeepingService {
  async getWorkboard(user) {
    const whereTask = user.role === 'housekeeping' ? 'AND (t.assigned_to = ? OR t.assigned_to IS NULL)' : ''
    const taskParams = user.role === 'housekeeping' ? [user.id] : []
    const [tasks, units, properties, history] = await Promise.all([
      query(`SELECT t.*, p.name AS property_name, p.address, p.city, p.housekeeping_status,
                    assigned.first_name AS assigned_first_name, assigned.last_name AS assigned_last_name,
                    reporter.first_name AS reporter_first_name, reporter.last_name AS reporter_last_name
             FROM housekeeping_tasks t JOIN properties p ON p.id = t.property_id
             LEFT JOIN users assigned ON assigned.id = t.assigned_to
             LEFT JOIN users reporter ON reporter.id = t.created_by
             WHERE t.status <> 'completed' ${whereTask}
             ORDER BY FIELD(t.priority, 'urgent', 'high', 'normal', 'low'), t.created_at ASC LIMIT 200`, taskParams),
      query(`SELECT p.id, p.name, p.type, p.address, p.city, p.housekeeping_status, p.status AS listing_status, p.updated_at,
                    (SELECT b.check_out_date FROM bookings b WHERE b.property_id = p.id AND b.status = 'checked_in' ORDER BY b.check_out_date LIMIT 1) AS occupied_until,
                    (SELECT COUNT(*) FROM housekeeping_tasks t WHERE t.property_id = p.id AND t.status <> 'completed') AS open_task_count
             FROM properties p
             WHERE p.housekeeping_status IN ('dirty', 'maintenance') OR p.status = 'maintenance'
             ORDER BY CASE WHEN p.housekeeping_status = 'maintenance' OR p.status = 'maintenance' THEN 0 ELSE 1 END, p.updated_at ASC LIMIT 200`),
      query("SELECT id, name, address, city FROM properties WHERE status <> 'inactive' ORDER BY name LIMIT 500"),
      query(`SELECT t.id, t.task_type, t.title, t.status, t.completed_at, t.property_id, p.name AS property_name
             FROM housekeeping_tasks t JOIN properties p ON p.id = t.property_id
             WHERE t.status = 'completed' AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             ${user.role === 'housekeeping' ? 'AND (t.assigned_to = ? OR t.completed_by = ?)' : ''}
             ORDER BY t.completed_at DESC LIMIT 20`, user.role === 'housekeeping' ? [user.id, user.id] : []),
    ])
    return { tasks, units, properties, history }
  }

  async createTask(data, userId) {
    const propertyId = String(data?.propertyId || '')
    const taskType = data?.taskType
    const title = String(data?.title || '').trim().slice(0, 150)
    const description = String(data?.description || '').trim().slice(0, 4000)
    const priority = data?.priority || 'normal'
    if (!propertyId || !['cleaning', 'maintenance'].includes(taskType) || !title) {
      throw new ValidationError('Property, task type, and title are required')
    }
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) throw new ValidationError('Invalid task priority')
    const [property] = await query('SELECT id FROM properties WHERE id = ?', [propertyId])
    if (!property) throw new NotFoundError('Property')
    const taskId = uuidv4()
    await query(`INSERT INTO housekeeping_tasks (id, property_id, task_type, title, description, priority, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [taskId, propertyId, taskType, title, description || null, priority, userId])
    if (taskType === 'cleaning') await query("UPDATE properties SET housekeeping_status = 'dirty', updated_at = NOW() WHERE id = ?", [propertyId])
    if (taskType === 'maintenance') await query("UPDATE properties SET housekeeping_status = 'maintenance', updated_at = NOW() WHERE id = ?", [propertyId])
    return this.getTask(taskId)
  }

  async getTask(taskId) {
    const tasks = await query(`SELECT t.*, p.name AS property_name FROM housekeeping_tasks t
      JOIN properties p ON p.id = t.property_id WHERE t.id = ?`, [taskId])
    if (!tasks.length) throw new NotFoundError('Housekeeping task')
    return tasks[0]
  }

  async updateTask(taskId, data, user) {
    const [task] = await query('SELECT * FROM housekeeping_tasks WHERE id = ?', [taskId])
    if (!task) throw new NotFoundError('Housekeeping task')
    if (user.role === 'housekeeping' && task.assigned_to && task.assigned_to !== user.id) {
      throw new ValidationError('This task is assigned to another team member')
    }
    const status = data?.status
    if (!['open', 'in_progress', 'completed'].includes(status)) throw new ValidationError('Invalid task status')
    if (task.assigned_to && data?.assignedTo && !['admin', 'cashier'].includes(user.role)) {
      throw new ValidationError('Only a manager can reassign a task')
    }
    const assignedTo = ['admin', 'cashier'].includes(user.role) ? (data?.assignedTo || task.assigned_to) : (user.role === 'housekeeping' && status !== 'open' ? user.id : task.assigned_to)
    if (assignedTo) {
      const [assignee] = await query("SELECT id FROM users WHERE id = ? AND role = 'housekeeping' AND status = 'active'", [assignedTo])
      if (!assignee) throw new ValidationError('Choose an active housekeeping account')
    }
    const staffNotes = data?.staffNotes === undefined ? task.staff_notes : String(data.staffNotes).trim().slice(0, 1000)
    await query(`UPDATE housekeeping_tasks SET status = ?, assigned_to = ?, staff_notes = ?,
      completed_by = ?, completed_at = ?, updated_at = NOW() WHERE id = ?`,
    [status, assignedTo || null, staffNotes || null, status === 'completed' ? user.id : task.completed_by,
      status === 'completed' ? new Date() : null, taskId])
    if (status === 'completed' && task.task_type === 'cleaning') {
      await this.updatePropertyStatus(task.property_id, 'clean', user)
    }
    return this.getTask(taskId)
  }

  async updatePropertyStatus(propertyId, status, user) {
    if (!['clean', 'dirty', 'maintenance'].includes(status)) throw new ValidationError('Status must be clean, dirty, or maintenance')
    const [property] = await query('SELECT id, name FROM properties WHERE id = ?', [propertyId])
    if (!property) throw new NotFoundError('Property')
    await query('UPDATE properties SET housekeeping_status = ?, updated_at = NOW() WHERE id = ?', [status, propertyId])
    if (status === 'clean') {
      await query(`UPDATE housekeeping_tasks SET status = 'completed', completed_by = ?, completed_at = NOW(), updated_at = NOW()
        WHERE property_id = ? AND task_type = 'cleaning' AND status <> 'completed'`, [user.id, propertyId])
    }
    if (status !== 'clean') {
      const taskType = status === 'dirty' ? 'cleaning' : 'maintenance'
      const title = status === 'dirty' ? 'Room cleaning required' : 'Maintenance attention required'
      const [existing] = await query(`SELECT id FROM housekeeping_tasks WHERE property_id = ? AND task_type = ? AND status <> 'completed' LIMIT 1`, [propertyId, taskType])
      if (!existing) {
        await query(`INSERT INTO housekeeping_tasks (id, property_id, task_type, title, priority, created_by)
          VALUES (?, ?, ?, ?, 'normal', ?)`, [uuidv4(), propertyId, taskType, title, user.id])
      }
    }
    return { propertyId, housekeepingStatus: status }
  }

  async createTurnoverTask(propertyId, userId = null) {
    await query("UPDATE properties SET housekeeping_status = 'dirty', updated_at = NOW() WHERE id = ?", [propertyId])
    const [existing] = await query(`SELECT id FROM housekeeping_tasks WHERE property_id = ? AND task_type = 'cleaning' AND status <> 'completed' LIMIT 1`, [propertyId])
    if (!existing) {
      await query(`INSERT INTO housekeeping_tasks (id, property_id, task_type, title, description, priority, created_by)
        VALUES (?, ?, 'cleaning', 'Guest checkout cleaning', 'Prepare the property for the next stay.', 'normal', ?)`, [uuidv4(), propertyId, userId])
    }
  }
}

export default new HousekeepingService()
