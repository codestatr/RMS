import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { FaBell, FaPaperPlane, FaEnvelope, FaCheck } from 'react-icons/fa'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } })

const fallbackCashierEmail = 'cashier@rms.com'

export default function NotificationsBell({ compact = false }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [recipientRole, setRecipientRole] = useState('cashier')
  const [recipientEmail, setRecipientEmail] = useState(fallbackCashierEmail)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('rms_admin_user') || localStorage.getItem('rms_admin_user') || '{}')
    } catch {
      return {}
    }
  }, [])

  async function load() {
    try {
      const response = await axios.get(`${API_URL}/notifications`, authConfig())
      setNotifications(response.data?.data || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  useEffect(() => {
    const userEmail = currentUser?.email || fallbackCashierEmail
    setRecipientEmail(userEmail)
  }, [currentUser?.email])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const unread = notifications.filter((item) => !item.read_at).length

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
        recipientEmail: recipientEmail || currentUser?.email || fallbackCashierEmail,
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
    <div className={`notifications-widget ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="notifications-trigger"
        title="Internal staff inbox"
      >
        <FaBell />
        <span className="notifications-label">Inbox</span>
        {unread > 0 && <span className="notifications-count">{unread}</span>}
      </button>

      {open && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <div>
              <strong>Cashier communication</strong>
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
              <span>Cashier email</span>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={fallbackCashierEmail}
              />
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
