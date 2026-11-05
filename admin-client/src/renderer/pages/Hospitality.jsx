import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { FaCheck, FaClock, FaPlane, FaTimes } from 'react-icons/fa'
import '../../styles/hospitality.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}`,
    },
  }
}

const statusLabels = {
  pending: 'Needs approval',
  approved: 'Approved',
  declined: 'Declined',
  fulfilled: 'Fulfilled',
}

export default function Hospitality() {
  const [requests, setRequests] = useState([])
  const [guestRequests, setGuestRequests] = useState([])
  const [guestDrafts, setGuestDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('rms_admin_user') || 'null'))

  async function loadRequests() {
    try {
      const [response, guestResponse] = await Promise.all([axios.get(`${API_URL}/bookings/service-requests`, {
        ...authConfig(),
        params: filter === 'all' ? {} : { status: filter },
      }), axios.get(`${API_URL}/guest-services`, authConfig())])
      setRequests(response.data?.data || [])
      setGuestRequests(guestResponse.data?.data || [])
    } catch (error) {
      console.error('Failed to load hospitality requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    const interval = setInterval(loadRequests, 10000)
    return () => clearInterval(interval)
  }, [filter])

  async function updateRequest(id, status, fulfillmentStatus = null, assignedTo = null) {
    try {
      const response = await axios.patch(
        `${API_URL}/bookings/service-requests/${id}`,
        { status, fulfillmentStatus, assignedTo },
        authConfig()
      )

      const updated = response.data?.data || []
      const nextStatus = status || 'pending'

      setRequests((current) => {
        const next = current.map((request) =>
          request.id === id
            ? {
                ...request,
                status: nextStatus,
                fulfillment_status: fulfillmentStatus || request.fulfillment_status,
                assigned_to: assignedTo ?? request.assigned_to,
              }
            : request
        )

        if (filter !== 'all') {
          return next.filter((request) => {
            const matchesFilter = request.status === filter
            if (request.id !== id) return matchesFilter
            return nextStatus === filter
          })
        }

        return next
      })

      if (updated && Array.isArray(updated)) {
        setRequests(updated)
      }

      await loadRequests()
    } catch (error) {
      console.error('Failed to update hospitality request:', error)
    }
  }

  async function updateGuestRequest(request, status) {
    const draft = guestDrafts[request.id] || {}
    try {
      await axios.patch(`${API_URL}/guest-services/${request.id}`, {
        status,
        quotedAmount: draft.amount ?? request.quoted_amount ?? '',
        staffNotes: draft.notes ?? request.staff_notes ?? '',
      }, authConfig())
      await loadRequests()
    } catch (error) {
      window.alert(error.response?.data?.error || 'Unable to update the guest request.')
    }
  }

  if (loading) return <div className="loading-spinner">Loading hospitality requests...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
            <FaPlane className="text-amber-500" /> Guest Services Desk
          </h2>
          <p className="text-xs text-neutral-500 mt-1">Approve airport pickups, cleaning, laundry, and arrival services requested by guests.</p>
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold">
          <option value="pending">Needs approval</option>
          <option value="approved">Approved</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="declined">Declined</option>
          <option value="all">All requests</option>
        </select>
      </div>

      <div className="admin-card overflow-x-auto">
        {requests.length === 0 ? (
          <div className="empty-state"><p>No hospitality requests in this view.</p></div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Service</th><th>Guest</th><th>Property / Pickup</th><th>Stay</th><th>Status</th><th>Progress</th><th>Action</th></tr></thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td style={{ whiteSpace: 'normal' }}>
                    <strong className="block text-neutral-900">{request.service_name}</strong>
                    <span className="block text-xs text-neutral-500 mt-1">KES {Number(request.unit_price).toLocaleString()}</span>
                  </td>
                  <td style={{ whiteSpace: 'normal' }}>
                    <span className="block font-semibold text-neutral-800">{request.first_name} {request.last_name}</span>
                    <span className="block text-xs text-neutral-500 mt-1">{request.phone || 'No phone'}</span>
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: '280px', maxWidth: '400px' }}>
                    <span className="block font-medium text-neutral-800">{request.property_name}</span>
                    {request.service_name === 'Airport pickup' && (
                      <div className="mt-1.5 flex flex-col gap-1 text-xs text-sky-700 bg-sky-50/50 p-2 rounded border border-sky-100">
                        <span className="font-semibold">📍 {request.pickup_location || 'Location pending'}</span>
                        {request.pickup_time && <span>⏰ {new Date(request.pickup_time).toLocaleString()}</span>}
                        {request.pickup_notes && <span className="text-neutral-600 italic">📝 {request.pickup_notes}</span>}
                      </div>
                    )}
                  </td>
                  <td className="text-xs" style={{ whiteSpace: 'normal' }}>
                    <span className="block">{request.check_in_date}</span>
                    <span className="block text-neutral-400">to</span>
                    <span className="block">{request.check_out_date}</span>
                  </td>
                  <td><span className={`status-badge status-${request.status}`}>{statusLabels[request.status] || request.status}</span></td>
                  <td className="text-xs" style={{ whiteSpace: 'normal' }}>
                    {request.service_name === 'Airport pickup' && <>
                      <span className="block font-semibold text-sky-700 uppercase tracking-wider">{request.fulfillment_status || 'pending'}</span>
                      {request.assigned_first_name && <span className="block text-neutral-500 mt-1 font-medium">{request.assigned_first_name} {request.assigned_last_name}</span>}
                    </>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {request.status === 'pending' && <><button title="Approve request" onClick={() => updateRequest(request.id, 'approved')} className="bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold"><FaCheck /></button><button title="Decline request" onClick={() => updateRequest(request.id, 'declined')} className="bg-rose-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold"><FaTimes /></button></>}
                      {request.status === 'approved' && request.service_name === 'Airport pickup' && !request.assigned_to && <button title="Assign pickup to me" onClick={() => updateRequest(request.id, 'approved', 'assigned', currentUser?.id)} className="bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold">Assign to me</button>}
                      {request.status === 'approved' && request.service_name === 'Airport pickup' && request.assigned_to && request.fulfillment_status === 'assigned' && <button title="Mark pickup en route" onClick={() => updateRequest(request.id, 'approved', 'en_route')} className="bg-sky-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold">En route</button>}
                      {request.status === 'approved' && request.service_name === 'Airport pickup' && request.fulfillment_status === 'en_route' && <button title="Mark guest pickup arrived" onClick={() => updateRequest(request.id, 'approved', 'arrived')} className="bg-sky-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold">Arrived</button>}
                      {request.status === 'approved' && request.service_name === 'Airport pickup' && request.fulfillment_status === 'arrived' && <button title="Complete pickup" onClick={() => updateRequest(request.id, 'fulfilled', 'completed')} className="bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold"><FaCheck /> Complete</button>}
                      {request.status === 'approved' && request.service_name !== 'Airport pickup' && <button title="Mark fulfilled" onClick={() => updateRequest(request.id, 'fulfilled')} className="bg-sky-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold"><FaCheck /> Fulfill</button>}
                      {request.status === 'fulfilled' && <span className="text-xs text-neutral-400 flex items-center gap-1"><FaClock /> Done</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="admin-card hospitality-orders-card space-y-4">
        <div><h3 className="text-lg font-extrabold text-neutral-900">In-stay service orders</h3><p className="text-xs text-neutral-500">Food to the room, transport from any pickup point, cleaning, and laundry.</p></div>
        {!guestRequests.length ? <div className="empty-state"><p>No in-stay guest service orders yet.</p></div> : <div className="hospitality-order-list">
          {guestRequests.map((request) => {
            const draft = guestDrafts[request.id] || {}
            return <article key={request.id} className="hospitality-order-card">
              <header className="hospitality-order-card-header"><div><strong>{request.service_type === 'food' ? 'Food order' : request.service_type === 'refreshments' ? 'Refreshments order' : request.service_type}</strong><span>{request.property_name} · {request.first_name} {request.last_name}</span></div><span className={`status-badge status-${request.status}`}>{request.status.replaceAll('_', ' ')}</span></header>
              <div className="hospitality-order-card-body">
                <div className="hospitality-order-details"><strong>Request</strong><p>{request.request_details}</p><span>{request.phone || request.email || 'No guest contact'} · {request.service_location || 'Inside the room'}</span>{request.service_type === 'transport' && <span>From {request.pickup_location} to {request.destination}</span>}{request.requested_for && <span>Requested: {new Date(request.requested_for).toLocaleString()}</span>}</div>
                <div className="hospitality-order-reply"><label>Quote (KES)<input aria-label="Quoted amount in KES" type="number" min="0" step="1" placeholder="Enter quote before accepting" disabled={['pending', 'paid'].includes(request.payment_status)} value={draft.amount ?? request.quoted_amount ?? ''} onChange={(event) => setGuestDrafts((current) => ({ ...current, [request.id]: { ...current[request.id], amount: event.target.value } }))} /></label><label>Reply / staff note<input aria-label="Reply to guest" maxLength={1000} placeholder="Reply to guest" value={draft.notes ?? request.staff_notes ?? ''} onChange={(event) => setGuestDrafts((current) => ({ ...current, [request.id]: { ...current[request.id], notes: event.target.value } }))} /></label><span className="text-[11px] font-bold capitalize text-neutral-500">Service payment: {request.payment_status || (request.quoted_amount ? 'unpaid' : 'not quoted')}</span></div>
                <div className="hospitality-order-actions">{request.status === 'requested' && <><button onClick={() => updateGuestRequest(request, 'accepted')} className="btn-primary text-xs">Accept &amp; quote</button><button onClick={() => updateGuestRequest(request, 'declined')} className="btn-secondary text-xs">Decline</button></>}{request.status === 'accepted' && <button disabled={Number(request.quoted_amount) > 0 && request.payment_status !== 'paid'} title={Number(request.quoted_amount) > 0 && request.payment_status !== 'paid' ? 'Waiting for guest payment' : 'Start this service'} onClick={() => updateGuestRequest(request, 'in_progress')} className="btn-primary text-xs disabled:opacity-50">Start</button>}{request.status === 'in_progress' && <button onClick={() => updateGuestRequest(request, 'completed')} className="btn-primary text-xs">Complete</button>}</div>
              </div>
            </article>
          })}
        </div>}
      </section>
    </div>
  )
}
