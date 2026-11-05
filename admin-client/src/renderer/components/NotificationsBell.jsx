import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { FaBell, FaPaperPlane, FaEnvelope, FaCheck } from 'react-icons/fa'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } })

export default function NotificationsBell({ compact = false }) {
  const [notifications, setNotifications] = useState([])
  const [recipients, setRecipients] = useState([])
  const [recipientId, setRecipientId] = useState('all')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [inboxError, setInboxError] = useState('')
  const [communicationError, setCommunicationError] = useState('')
  const [communicationNotice, setCommunicationNotice] = useState('')
  const [panelPosition, setPanelPosition] = useState({ left: 12, top: 80 })
  const widgetRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  async function load() {
    try {
      const response = await axios.get(`${API_URL}/notifications`, authConfig())
      setNotifications(response.data?.data || [])
      setInboxError('')
    } catch (error) {
      console.error('Failed to load notifications:', error)
      setInboxError(error.response?.data?.error || 'Could not load inbox messages.')
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!communicationNotice) return undefined
    const timeout = setTimeout(() => setCommunicationNotice(''), 4500)
    return () => clearTimeout(timeout)
  }, [communicationNotice])

  const unread = notifications.filter((item) => !item.read_at).length

  async function loadRecipients() {
    setLoadingRecipients(true)
    setCommunicationError('')
    try {
      const response = await axios.get(`${API_URL}/notifications/recipients`, authConfig())
      setRecipients(response.data?.data || [])
    } catch (error) {
      setCommunicationError(error.response?.data?.error || 'Could not load active staff users.')
    } finally {
      setLoadingRecipients(false)
    }
  }

  function updatePanelPosition() {
    const bounds = triggerRef.current?.getBoundingClientRect()
    if (!bounds) return
    setPanelPosition({
      left: Math.max(12, Math.min(bounds.right - 340, window.innerWidth - 352)),
      top: Math.max(12, Math.min(bounds.bottom + 8, window.innerHeight - 420)),
    })
  }

  function toggleInbox() {
    if (open) {
      setOpen(false)
      return
    }
    updatePanelPosition()
    load()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    loadRecipients()
    const closeOnOutsideClick = (event) => {
      if (!widgetRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false)
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
    try {
      await axios.patch(`${API_URL}/notifications/${id}/read`, {}, authConfig())
      await load()
    } catch (error) {
      setCommunicationError(error.response?.data?.error || 'Could not mark this message as read.')
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedMessage = message.trim()
    if (!trimmedTitle || !trimmedMessage) return

    setSending(true)
    setCommunicationError('')
    setCommunicationNotice('')
    try {
      const requestPayload = {
        sendToAll: recipientId === 'all',
        ...(recipientId === 'all' ? {} : { recipientId }),
        title: trimmedTitle,
        message: trimmedMessage,
      }
      const response = await axios.post(`${API_URL}/notifications/staff`, requestPayload, authConfig())
      const sentCount = response.data?.data?.sent || 0
      setTitle('')
      setMessage('')
      setCommunicationNotice(`Message sent to ${sentCount} ${sentCount === 1 ? 'staff user' : 'staff users'}.`)
      await load()
    } catch (error) {
      setCommunicationError(error.response?.data?.error || 'Could not send the message. Please try again.')
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
        {!compact && <span className="notifications-label">Inbox</span>}
        {unread > 0 && <span className="notifications-count">{unread}</span>}
      </button>

      {communicationNotice && createPortal(
        <div className="notifications-toast" role="status" aria-live="polite">
          <span className="notifications-toast-icon"><FaCheck /></span>
          <span className="notifications-toast-copy">
            <strong>Message sent</strong>
            <small>{communicationNotice}</small>
          </span>
          <button type="button" aria-label="Dismiss message sent notice" onClick={() => setCommunicationNotice('')}>×</button>
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div ref={panelRef} id="staff-inbox-panel" className="notifications-panel" style={panelPosition}>
          <div className="notifications-header">
            <div>
              <strong>Staff inbox</strong>
              <span>{unread} unread</span>
            </div>
            <FaEnvelope className="text-amber-500" />
          </div>

          <div className="notifications-list">
            {inboxError ? (
              <div className="notifications-feedback error" role="alert">{inboxError}</div>
            ) : notifications.length === 0 ? (
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
              <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} disabled={loadingRecipients || recipients.length === 0}>
                <option value="all">All active staff</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {[recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || recipient.email} · {recipient.role.replace('_', ' ')}
                  </option>
                ))}
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

            {communicationError && <div className="notifications-feedback error" role="alert">{communicationError}</div>}
            <button type="submit" className="notifications-send" disabled={sending || loadingRecipients || recipients.length === 0}>
              {sending ? <><FaCheck /> Sending...</> : <><FaPaperPlane /> Send message</>}
            </button>
          </form>
        </div>,
        document.body,
      )}
    </div>
  )
}
