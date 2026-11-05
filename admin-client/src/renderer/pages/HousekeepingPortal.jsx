import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { FaBroom, FaCheck, FaExclamationTriangle, FaPlus, FaSyncAlt, FaTools } from 'react-icons/fa'
import '../../styles/housekeeping-portal.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } })

export default function HousekeepingPortal({ user, view = 'overview' }) {
  const [board, setBoard] = useState({ tasks: [], units: [], properties: [], history: [], guestRequests: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [guestDrafts, setGuestDrafts] = useState({})
  const [showReport, setShowReport] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ propertyId: '', taskType: 'maintenance', title: '', description: '', priority: 'normal' })

  const loadBoard = useCallback(async () => {
    const [boardResult, servicesResult] = await Promise.allSettled([
      axios.get(`${API_URL}/housekeeping/workboard`, authConfig()),
      axios.get(`${API_URL}/guest-services`, authConfig()),
    ])
    if (boardResult.status === 'fulfilled') {
      setBoard((current) => ({ ...current, ...(boardResult.value.data?.data || {}) }))
    }
    if (servicesResult.status === 'fulfilled') {
      setBoard((current) => ({ ...current, guestRequests: servicesResult.value.data?.data || [] }))
    }
    const errors = []
    if (boardResult.status === 'rejected') errors.push(boardResult.reason.response?.data?.error || 'Unable to load the housekeeping workboard.')
    if (servicesResult.status === 'rejected') errors.push(servicesResult.reason.response?.data?.error || 'Unable to load guest laundry requests.')
    setError(errors.join(' '))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBoard()
    const timer = window.setInterval(loadBoard, 10000)
    return () => window.clearInterval(timer)
  }, [loadBoard])

  const updateTask = async (taskId, status) => {
    setSaving(true); setError(''); setNotice('')
    try {
      await axios.patch(`${API_URL}/housekeeping/tasks/${taskId}`, { status }, authConfig())
      setNotice(status === 'completed' ? 'Task completed.' : 'Task assigned to you.')
      await loadBoard()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update this task.')
    } finally { setSaving(false) }
  }

  const updateUnit = async (propertyId, housekeepingStatus) => {
    setSaving(true); setError(''); setNotice('')
    try {
      await axios.patch(`${API_URL}/properties/${propertyId}/housekeeping-status`, { housekeepingStatus }, authConfig())
      setNotice(housekeepingStatus === 'clean' ? 'Room readiness updated.' : 'Room added to the work queue.')
      await loadBoard()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update room readiness.')
    } finally { setSaving(false) }
  }

  const updateGuestRequest = async (request, status) => {
    const draft = guestDrafts[request.id] || {}
    try {
      await axios.patch(`${API_URL}/guest-services/${request.id}`, {
        status,
        quotedAmount: draft.amount ?? request.quoted_amount ?? '',
        staffNotes: request.staff_notes || '',
      }, authConfig())
      setNotice('Guest room service updated.')
      await loadBoard()
    } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to update this room service.') }
  }

  const createTask = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await axios.post(`${API_URL}/housekeeping/tasks`, form, authConfig())
      setForm({ propertyId: '', taskType: 'maintenance', title: '', description: '', priority: 'normal' })
      setShowReport(false); setNotice('Task reported to the housekeeping workboard.')
      await loadBoard()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to report this task.')
    } finally { setSaving(false) }
  }

  const filteredTasks = board.tasks.filter((task) => filter === 'all' || task.status === filter || task.task_type === filter)
  const cleaningCount = board.units.filter((unit) => unit.housekeeping_status === 'dirty').length
  const maintenanceCount = board.units.filter((unit) => unit.housekeeping_status === 'maintenance' || unit.listing_status === 'maintenance').length
  const viewCopy = {
    overview: ['PROPERTY CARE OVERVIEW', 'Rooms, tasks, and guest requests at a glance.'],
    tasks: ['TASK QUEUE', 'Claim and complete cleaning or maintenance work assigned to your team.'],
    rooms: ['ROOM READINESS', 'See rooms needing cleaning or maintenance and update readiness.'],
    guest_requests: ['GUEST LAUNDRY & CLEANING', 'Manage guest requests routed to the housekeeping team.'],
    history: ['COMPLETED WORK', 'Review work completed by the housekeeping team recently.'],
  }[view] || ['PROPERTY CARE OVERVIEW', 'Rooms, tasks, and guest requests at a glance.']

  return <main className="housekeeping-portal">
    <header className="housekeeping-hero">
      <div><span className="housekeeping-eyebrow">{viewCopy[0]}</span><h2>{view === 'overview' ? `Good work, ${user?.firstName || 'team'}.` : viewCopy[0].replaceAll('&', 'and')}</h2><p>{viewCopy[1]}</p></div>
      <div className="housekeeping-hero-actions"><button type="button" onClick={() => setShowReport((value) => !value)} className="btn-primary"><FaPlus /> Report a task</button><button type="button" onClick={() => { setLoading(true); loadBoard() }} className="housekeeping-refresh"><FaSyncAlt /> Refresh</button></div>
    </header>

    {error && <p className="housekeeping-alert error" role="alert">{error}</p>}
    {notice && <p className="housekeeping-alert success" role="status">{notice}</p>}

    {view === 'overview' && <section className="housekeeping-stats" aria-label="Housekeeping summary">
      <article><span className="housekeeping-stat-icon cleaning"><FaBroom /></span><div><small>Needs cleaning</small><strong>{loading ? '…' : cleaningCount}</strong></div></article>
      <article><span className="housekeeping-stat-icon repair"><FaTools /></span><div><small>Maintenance</small><strong>{loading ? '…' : maintenanceCount}</strong></div></article>
      <article><span className="housekeeping-stat-icon tasks"><FaExclamationTriangle /></span><div><small>Open tasks</small><strong>{loading ? '…' : board.tasks.length}</strong></div></article>
      <article><span className="housekeeping-stat-icon done"><FaCheck /></span><div><small>Completed today</small><strong>{loading ? '…' : board.history.filter((task) => new Date(task.completed_at).toDateString() === new Date().toDateString()).length}</strong></div></article>
    </section>}

    {showReport && <form className="housekeeping-report-card" onSubmit={createTask}>
      <div><h3>Report cleaning or maintenance work</h3><p>Add the property and describe the issue for the team.</p></div>
      <div className="housekeeping-form-grid">
        <label>Property<select required value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value })}><option value="">Choose a property</option>{board.properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.city}</option>)}</select></label>
        <label>Task type<select value={form.taskType} onChange={(event) => setForm({ ...form, taskType: event.target.value })}><option value="maintenance">Maintenance</option><option value="cleaning">Cleaning</option></select></label>
        <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label>Short title<input required maxLength={150} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Leaking bathroom tap" /></label>
        <label className="wide">Details<textarea rows={3} maxLength={4000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe what needs attention" /></label>
      </div>
      <div className="housekeeping-form-actions"><button type="button" className="btn-secondary" onClick={() => setShowReport(false)}>Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Send to workboard'}</button></div>
    </form>}

    {view === 'rooms' && <section className="housekeeping-section">
      <div className="housekeeping-section-heading"><div><h3>Room readiness</h3><p>Properties marked dirty or under maintenance are surfaced here.</p></div><span>{board.units.length} properties</span></div>
      {loading ? <p className="housekeeping-empty">Loading room status…</p> : board.units.length === 0 ? <p className="housekeeping-empty">All listed properties are clean and ready.</p> : <div className="housekeeping-room-grid">{board.units.map((unit) => {
        const maintenance = unit.housekeeping_status === 'maintenance' || unit.listing_status === 'maintenance'
        return <article className={`housekeeping-room-card ${maintenance ? 'maintenance' : 'dirty'}`} key={unit.id}>
          <div className="housekeeping-room-heading"><span>{maintenance ? <FaTools /> : <FaBroom />}{maintenance ? 'Maintenance' : 'Needs cleaning'}</span><small>{unit.type?.replaceAll('_', ' ')}</small></div>
          <h4>{unit.name}</h4><p>{unit.address}{unit.city ? `, ${unit.city}` : ''}</p>
          {unit.occupied_until && <p className="housekeeping-occupancy">Guest currently checked in · Checkout {new Date(unit.occupied_until).toLocaleDateString()}</p>}
          {maintenance && unit.listing_status === 'maintenance' && <p className="housekeeping-manager-note">After the repair, notify a manager to reopen this listing for bookings.</p>}
          <button type="button" disabled={saving || unit.housekeeping_status === 'clean'} onClick={() => updateUnit(unit.id, 'clean')}>Mark room ready</button>
        </article>
      })}</div>}
    </section>}

    {view === 'guest_requests' && <section className="housekeeping-section">
      <div className="housekeeping-section-heading"><div><h3>Guest room cleaning &amp; laundry</h3><p>Guest orders that need the housekeeping team.</p></div><span>{board.guestRequests.filter((request) => !['completed', 'declined'].includes(request.status)).length} open</span></div>
      {board.guestRequests.length === 0 ? <p className="housekeeping-empty">No guest cleaning or laundry requests.</p> : <div className="housekeeping-task-list">{board.guestRequests.map((request) => <article className="housekeeping-task-card" key={request.id}><div className="housekeeping-task-main"><div className="housekeeping-task-tags"><span>{request.service_type}</span><span>{request.status.replaceAll('_', ' ')}</span></div><h4>{request.property_name} · {request.first_name} {request.last_name}</h4><p>{request.request_details}</p><small>{request.service_location || 'Inside the room'} · {new Date(request.created_at).toLocaleString()}</small>{request.service_type === 'laundry' && <label className="housekeeping-quote">Quote (KES)<input type="number" min="0" step="1" disabled={['pending', 'paid'].includes(request.payment_status)} placeholder="Enter quote before accepting" value={guestDrafts[request.id]?.amount ?? request.quoted_amount ?? ''} onChange={(event) => setGuestDrafts((current) => ({ ...current, [request.id]: { ...current[request.id], amount: event.target.value } }))} /></label>}<small>Service payment: {request.payment_status || (request.quoted_amount ? 'unpaid' : 'not quoted')}</small></div><div className="housekeeping-task-actions">{request.status === 'requested' && <button onClick={() => updateGuestRequest(request, 'accepted')}>Accept &amp; quote</button>}{request.status === 'accepted' && <button disabled={Number(request.quoted_amount) > 0 && request.payment_status !== 'paid'} title={Number(request.quoted_amount) > 0 && request.payment_status !== 'paid' ? 'Waiting for guest payment' : 'Start this service'} onClick={() => updateGuestRequest(request, 'in_progress')}>Start</button>}{request.status === 'in_progress' && <button onClick={() => updateGuestRequest(request, 'completed')}><FaCheck /> Complete</button>}</div></article>)}</div>}
    </section>}

    {view === 'tasks' && <section className="housekeeping-section">
      <div className="housekeeping-section-heading"><div><h3>Team workboard</h3><p>Claim an unassigned task, start work, and mark it complete.</p></div><select aria-label="Filter housekeeping tasks" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All active tasks</option><option value="cleaning">Cleaning</option><option value="maintenance">Maintenance</option><option value="in_progress">In progress</option><option value="open">Not started</option></select></div>
      {loading ? <p className="housekeeping-empty">Loading team tasks…</p> : filteredTasks.length === 0 ? <p className="housekeeping-empty">No open tasks in this view. New checkout cleanings and reported issues appear here.</p> : <div className="housekeeping-task-list">{filteredTasks.map((task) => <article className={`housekeeping-task-card priority-${task.priority}`} key={task.id}>
        <div className="housekeeping-task-main"><div className="housekeeping-task-tags"><span>{task.task_type}</span><span>{task.priority} priority</span><span>{task.status.replaceAll('_', ' ')}</span></div><h4>{task.title}</h4><p>{task.property_name} · {task.address}{task.city ? `, ${task.city}` : ''}</p>{task.description && <p className="housekeeping-task-description">{task.description}</p>}{task.assigned_first_name && <small>Assigned to {task.assigned_first_name} {task.assigned_last_name}</small>}</div>
        <div className="housekeeping-task-actions">{task.status === 'open' && <button disabled={saving || (task.assigned_to && task.assigned_to !== user?.id)} onClick={() => updateTask(task.id, 'in_progress')}>Start work</button>}{task.status === 'in_progress' && <button disabled={saving || (task.assigned_to && task.assigned_to !== user?.id)} onClick={() => updateTask(task.id, 'completed')}><FaCheck /> Complete</button>}</div>
      </article>)}</div>}
    </section>}

    {view === 'history' && <section className="housekeeping-section"><div className="housekeeping-section-heading"><div><h3>Recently completed</h3><p>Work completed during the past two weeks.</p></div><span>{board.history.length} tasks</span></div>{board.history.length > 0 ? <div className="housekeeping-history">{board.history.map((task) => <div key={task.id}><FaCheck /><span><strong>{task.title}</strong><small>{task.property_name} · {new Date(task.completed_at).toLocaleString()}</small></span></div>)}</div> : <p className="housekeeping-empty">No completed housekeeping work in recent history.</p>}</section>}
  </main>
}
