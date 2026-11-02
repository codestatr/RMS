import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { FaBell, FaPaperPlane, FaEnvelope, FaCheck } from 'react-icons/fa'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } })

export default function NotificationsBell({ compact = false, userRole = 'admin' }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [recipientRole, setRecipientRole] = useState(userRole === 'cashier' ? 'admin' : 'cashier')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ left: 12, bottom: 80 })
  const widgetRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    setRecipientRole(userRole === 'cashier' ? 'admin' : 'cashier')
  }, [userRole])

  async function load() {
    try {
      const response = await axios.get(`${API_URL}/notifications`, authConfig())
      setNotifications(response.data?.data || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const unread = notifications.filter((item) => !item.read_at).length

  function updatePanelPosition() {
    const bounds = triggerRef.current?.getBoundingClientRect()
    if (!bounds) return
    setPanelPosition({
      left: Math.max(12, Math.min(bounds.right + 12, window.innerWidth - 352)),
      bottom: Math.max(12, window.innerHeight - bounds.top + 8),
    })
  }

  function toggleInbox() {
    if (open) {
      setOpen(false)
      return
    }
    updatePanelPosition()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!widgetRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  async function markRead(id) {
    await axios.patch(`${API_URL}/notifications/${id}/read`, {}, authConfig())
    load()
  }

  async function sendMessage(event) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedMessage = message.trim()
    if (!trimmedTitle || !trimmedMessage) return

    setSending(true)
    try {
      const requestPayload = {
        recipientRole,
        title: trimmedTitle,
        message: trimmedMessage,
      }
      await axios.post(`${API_URL}/notifications/staff`, requestPayload, authConfig())
      setTitle('')
      setMessage('')
      setOpen(false)
      await load()
    } finally {
      setSending(false)
    }
  }

  return (
    <div ref={widgetRef} className={`notifications-widget ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggleInbox}
        className="notifications-trigger"
        title="Internal staff inbox"
        aria-expanded={open}
        aria-controls="staff-inbox-panel"
      >
        <FaBell />
        <span className="notifications-label">Inbox</span>
        {unread > 0 && <span className="notifications-count">{unread}</span>}
      </button>

      {open && (
        <div id="staff-inbox-panel" className="notifications-panel" style={panelPosition}>
          <div className="notifications-header">
            <div>
              <strong>Staff inbox</strong>
              <span>{unread} unread</span>
            </div>
            <FaEnvelope className="text-amber-500" />
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notifications-empty">No messages yet.</div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item.id)}
                  className={`notification-item ${item.read_at ? 'read' : 'unread'}`}
                >
                  <div className="notification-title-row">
                    <span className="notification-title">{item.title}</span>
                    {!item.read_at && <span className="notification-dot" />}
                  </div>
                  <span className="notification-message">{item.message}</span>
                  <span className="notification-meta">From {item.sender_name || 'System'}</span>
                </button>
              ))
            )}
          </div>

          <form onSubmit={sendMessage} className="notifications-form">
            <label className="notifications-field">
              <span>Send to</span>
              <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value)}>
                <option value="cashier">Cashier inbox</option>
                <option value="admin">Admin team</option>
              </select>
            </label>

            <label className="notifications-field">
              <span>Subject</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shift handover" />
            </label>

            <label className="notifications-field">
              <span>Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows="3" placeholder="Share update for the cashier desk..." />
            </label>

            <button type="submit" className="notifications-send" disabled={sending}>
              {sending ? <><FaCheck /> Sending...</> : <><FaPaperPlane /> Send message</>}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
