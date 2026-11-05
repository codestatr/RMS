import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import '../../styles/owner-portal.css'
import { OperationsOverview } from './Dashboard'
import { optimizePropertyImage } from '../utils/propertyImages'
import {
  FaBed, FaBuilding, FaCalendarAlt, FaCalendarCheck, FaCheck, FaConciergeBell,
  FaEdit, FaHome, FaMoneyBillWave, FaPlus, FaStar, FaUser,
} from 'react-icons/fa'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } })
const money = (amount) => `KES ${Number(amount || 0).toLocaleString()}`
const propertyImages = (property) => Array.isArray(property?.images)
  ? property.images.filter(Boolean)
  : String(property?.images || property?.image_url || '').split('||').filter(Boolean)
const emptyProperty = {
  name: '', type: 'airbnb', description: '', address: '', city: '', country: 'Kenya',
  pricePerNight: '', pricePerWeek: '', pricePerMonth: '', capacity: 1, bedrooms: 1,
  bathrooms: 1, status: 'available', imageUrl: '', images: [],
}
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—'

export default function OwnerPortal({ user, onUserUpdate }) {
  const [overview, setOverview] = useState({ properties: [], stats: {}, bookings: [], services: [], guestServiceRequests: [], payments: [], reviews: [], monthlyRevenue: [] })
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingProperty, setEditingProperty] = useState(null)
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [profile, setProfile] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '' })

  const loadOverview = useCallback(async () => {
    try {
      const [response, guestServices] = await Promise.all([
        axios.get(`${API_URL}/owner-portal/overview`, authConfig()),
        axios.get(`${API_URL}/guest-services`, authConfig()),
      ])
      setOverview((current) => ({ ...current, ...(response.data?.data || {}), guestServiceRequests: guestServices.data?.data || [] }))
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load your owner portal.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])

  async function saveProperty(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const images = propertyImages(editingProperty)
      const payload = { ...editingProperty, images, imageUrl: editingProperty.imageUrl || images[0] || '', pricePerNight: Number(editingProperty.pricePerNight), pricePerWeek: editingProperty.pricePerWeek ? Number(editingProperty.pricePerWeek) : null, pricePerMonth: editingProperty.pricePerMonth ? Number(editingProperty.pricePerMonth) : null }
      if (editingProperty.id) await axios.put(`${API_URL}/owner-portal/properties/${editingProperty.id}`, payload, authConfig())
      else await axios.post(`${API_URL}/owner-portal/properties`, payload, authConfig())
      setEditingProperty(null)
      setNotice('Property details saved.')
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to save property details.')
    } finally {
      setSaving(false)
    }
  }

  async function updateHousekeeping(propertyId, housekeepingStatus) {
    try {
      await axios.patch(`${API_URL}/owner-portal/properties/${propertyId}/housekeeping`, { housekeepingStatus }, authConfig())
      setNotice('Room readiness updated.')
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update room readiness.')
    }
  }

  async function updateBooking(id, status) {
    try {
      await axios.patch(`${API_URL}/owner-portal/bookings/${id}/status`, { status }, authConfig())
      setNotice(`Reservation ${status}.`)
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update this reservation.')
    }
  }

  async function updateService(id, status) {
    try {
      await axios.patch(`${API_URL}/owner-portal/room-service/${id}`, { status }, authConfig())
      setNotice(`Guest service ${status}.`)
      await loadOverview()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update this guest service request.')
    }
  }

  async function updateGuestService(id, status) {
    try {
      await axios.patch(`${API_URL}/guest-services/${id}`, { status }, authConfig())
      setNotice(`Guest request ${status.replaceAll('_', ' ')}.`)
      await loadOverview()
    } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to update the guest service request.') }
  }

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await axios.put(`${API_URL}/users/${user.id}`, profile, authConfig())
      const nextUser = { ...user, ...profile }
      localStorage.setItem('rms_admin_user', JSON.stringify(nextUser))
      sessionStorage.setItem('rms_admin_user', JSON.stringify(nextUser))
      onUserUpdate?.(nextUser)
      setNotice('Contact details updated.')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update contact details.')
    } finally {
      setSaving(false)
    }
  }

  const stats = overview.stats || {}
  const tabs = [
    ['overview', 'Dashboard'], ['properties', 'Property listings'], ['bookings', 'Bookings'],
    ['availability', 'Availability'], ['services', 'Guest services'], ['finance', 'Financial reports'],
    ['reviews', 'Guest reviews'], ['profile', 'Account'],
  ]
  const visibleBookings = overview.bookings.filter((booking) =>
    (bookingStatusFilter === 'all' || booking.status === bookingStatusFilter)
    && (propertyFilter === 'all' || booking.property_id === propertyFilter)
  )

  if (loading) return <div className="loading-spinner">Loading your owner portal...</div>

  return (
    <div className="owner-portal">
      <section className="admin-card owner-intro">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Owner workspace</p>
        <h2 className="mt-2 text-2xl font-black text-neutral-900">Your properties, reservations, and guest services</h2>
        <p className="mt-2 text-sm text-neutral-500">Manage your listings, follow each stay, and review payments and guest requests across your properties.</p>
      </section>

      {error && <div className="login-error" role="alert">{error}</div>}
      {notice && <div className="settings-feedback-success" role="status">{notice}</div>}

      <div className="owner-kpis">
        {[
          [FaBuilding, 'Your properties', stats.property_count || 0],
          [FaCalendarCheck, 'Active stays', stats.active_stays || 0],
          [FaBed, 'Pending reservations', stats.pending_bookings || 0],
          [FaMoneyBillWave, 'Paid this month', money(stats.monthly_revenue)],
        ].map(([Icon, label, value]) => <div key={label} className="admin-card owner-kpi">
          <span className="owner-kpi-icon"><Icon /></span>
          <div><p className="owner-kpi-label">{label}</p><p className="owner-kpi-value">{value}</p></div>
        </div>)}
      </div>

      <nav className="owner-tabs" aria-label="Owner portal sections">
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`owner-tab ${activeTab === id ? 'is-active' : ''}`}>{label}</button>)}
      </nav>

      {activeTab === 'overview' && <Overview properties={overview.properties} bookings={overview.bookings} onNavigate={(target) => setActiveTab(target === 'bookings' ? 'bookings' : target === 'hospitality' ? 'services' : target === 'maintenance' ? 'properties' : 'overview')} onEdit={(property) => setEditingProperty({ ...property, pricePerNight: property.price_per_night, pricePerWeek: property.price_per_week || '', pricePerMonth: property.price_per_month || '', images: propertyImages(property), imageUrl: property.image_url || propertyImages(property)[0] || '' })} onAdd={() => setEditingProperty({ ...emptyProperty })} onRoomReady={updateHousekeeping} />}

      {activeTab === 'properties' && <Properties properties={overview.properties} onAdd={() => setEditingProperty({ ...emptyProperty })} onEdit={(property) => setEditingProperty({ ...property, pricePerNight: property.price_per_night, pricePerWeek: property.price_per_week || '', pricePerMonth: property.price_per_month || '', images: propertyImages(property), imageUrl: property.image_url || propertyImages(property)[0] || '' })} onRoomReady={updateHousekeeping} />}

      {activeTab === 'bookings' && <Bookings bookings={visibleBookings} properties={overview.properties} status={bookingStatusFilter} onStatus={setBookingStatusFilter} property={propertyFilter} onProperty={setPropertyFilter} onUpdate={updateBooking} />}

      {activeTab === 'availability' && <Availability bookings={overview.bookings} properties={overview.properties} />}

      {activeTab === 'services' && <RoomServices services={overview.services} guestRequests={overview.guestServiceRequests} onUpdate={updateService} onUpdateGuest={updateGuestService} />}

      {activeTab === 'finance' && <Finances payments={overview.payments} monthlyRevenue={overview.monthlyRevenue} stats={stats} />}

      {activeTab === 'reviews' && <Reviews reviews={overview.reviews} />}

      {activeTab === 'profile' && <form className="admin-card max-w-3xl space-y-5" onSubmit={saveProfile}>
        <div className="flex items-center gap-3"><FaUser className="text-neutral-500" /><div><h3 className="font-extrabold">Owner contact details</h3><p className="text-sm text-neutral-500">These details help the operations team contact you about your listings.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="form-field"><span className="form-label">First name</span><input required value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} className="form-input" /></label>
          <label className="form-field"><span className="form-label">Last name</span><input required value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} className="form-input" /></label>
          <label className="form-field"><span className="form-label">Phone</span><input value={profile.phone || ''} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="form-input" /></label>
          <label className="form-field"><span className="form-label">Email</span><input disabled value={user?.email || ''} className="form-input" /></label>
        </div>
        <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save contact details'}</button>
      </form>}

      {editingProperty && <PropertyEditor property={editingProperty} saving={saving} onChange={setEditingProperty} onCancel={() => setEditingProperty(null)} onSave={saveProperty} />}
    </div>
  )
}

function Overview({ properties, bookings, onNavigate, onEdit, onAdd, onRoomReady }) {
  const upcoming = bookings.filter((booking) => ['pending', 'confirmed', 'checked_in'].includes(booking.status)).slice(0, 5)
  return <div className="space-y-7">
    <OperationsOverview userRole="property_owner" onNavigate={onNavigate} />
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-extrabold">Your properties</h3><button onClick={onAdd} className="btn-primary flex items-center gap-2"><FaPlus /> Add listing</button></div>
      {properties.length ? <PropertyCards properties={properties.slice(0, 3)} onEdit={onEdit} onRoomReady={onRoomReady} /> : <div className="admin-card p-8 text-sm text-neutral-500">No listings yet. Add a property to start managing availability, stays, and guest services.</div>}
    </section>
    <section className="admin-card overflow-x-auto"><div className="flex items-center gap-2 p-5"><FaCalendarAlt className="text-neutral-500" /><h3 className="font-extrabold">Upcoming activity</h3></div>
      {upcoming.length ? <BookingTable bookings={upcoming} onUpdate={() => {}} compact /> : <p className="px-5 pb-5 text-sm text-neutral-500">No upcoming reservations.</p>}
    </section>
  </div>
}

function Properties({ properties, onAdd, onEdit, onRoomReady }) {
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold">Listing management</h3><p className="text-sm text-neutral-500">Edit listing details and rates. Set listings to inactive to pause new reservations.</p></div><button onClick={onAdd} className="btn-primary flex items-center gap-2"><FaPlus /> Add property</button></div>
    {properties.length ? <PropertyCards properties={properties} onEdit={onEdit} onRoomReady={onRoomReady} /> : <div className="admin-card p-8 text-sm text-neutral-500">No properties are linked to this account.</div>}
  </section>
}

function PropertyCards({ properties, onEdit, onRoomReady }) {
  return <div className="owner-property-grid">{properties.map((property) => <article key={property.id} className="admin-card overflow-hidden p-0">
    {property.image_url && <img src={property.image_url} alt={`${property.name}`} className="owner-property-image" />}
    <div className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3"><div><h4 className="text-lg font-extrabold">{property.name}</h4><p className="text-sm text-neutral-500">{property.address}, {property.city}</p></div><span className={`status-badge status-${property.status}`}>{property.status}</span></div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Value label="Night" value={money(property.price_per_night)} /><Value label="Capacity" value={`${property.capacity || 1} guests`} /><Value label="Rating" value={property.average_rating ? `${Number(property.average_rating).toFixed(1)} / 5` : 'No reviews'} /><Value label="Reviews" value={property.review_count || 0} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4"><label className="flex items-center gap-2 text-sm"><span className="font-semibold">Room readiness</span><select value={property.housekeeping_status || 'clean'} onChange={(event) => onRoomReady(property.id, event.target.value)} className="form-input"><option value="clean">Ready</option><option value="dirty">Needs cleaning</option><option value="maintenance">Maintenance</option></select></label><button onClick={() => onEdit(property)} className="btn-secondary flex items-center gap-2"><FaEdit /> Edit listing</button></div>
    </div>
  </article>)}</div>
}

function Bookings({ bookings, properties, status, onStatus, property, onProperty, onUpdate }) {
  return <section className="admin-card space-y-4 overflow-x-auto">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-extrabold">Reservations &amp; guest stays</h3><p className="text-sm text-neutral-500">Confirm or cancel pending reservations and monitor arrival and checkout dates.</p></div>
      <div className="owner-filters"><label><span>Booking status</span><select aria-label="Filter by booking status" value={status} onChange={(event) => onStatus(event.target.value)} className="form-input"><option value="all">All statuses</option>{['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label><span>Property</span><select aria-label="Filter by property" value={property} onChange={(event) => onProperty(event.target.value)} className="form-input"><option value="all">All properties</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    </div>
    {bookings.length ? <BookingTable bookings={bookings} onUpdate={onUpdate} /> : <p className="py-5 text-sm text-neutral-500">No reservations match these filters.</p>}
  </section>
}

function BookingTable({ bookings, onUpdate, compact = false }) {
  return <table className="admin-table"><thead><tr><th>Guest</th><th>Property</th><th>Stay dates</th>{!compact && <><th>Contact</th><th>Guests</th><th>Total</th></>}<th>Status</th>{!compact && <th>Actions</th>}</tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}>
    <td>{booking.first_name} {booking.last_name}</td><td>{booking.property_name}</td><td>{formatDate(booking.check_in_date)} – {formatDate(booking.check_out_date)}</td>
    {!compact && <><td>{booking.phone || booking.email || '—'}</td><td>{booking.number_of_guests}</td><td>{money(booking.total_amount)}</td></>}
    <td><span className={`status-badge status-${booking.status}`}>{booking.status.replaceAll('_', ' ')}</span></td>
    {!compact && <td className="flex gap-2">{booking.status === 'pending' && <><button onClick={() => onUpdate(booking.id, 'confirmed')} className="btn-primary text-xs">Confirm</button><button onClick={() => onUpdate(booking.id, 'cancelled')} className="btn-secondary text-xs">Decline</button></>}{booking.status === 'confirmed' && <button onClick={() => onUpdate(booking.id, 'cancelled')} className="btn-secondary text-xs">Cancel</button>}</td>}
  </tr>)}</tbody></table>
}

function Availability({ bookings, properties }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [propertyId, setPropertyId] = useState('all')
  const filtered = bookings.filter((booking) => ['confirmed', 'checked_in'].includes(booking.status)
    && booking.check_in_date.slice(0, 7) <= month && booking.check_out_date.slice(0, 7) >= month
    && (propertyId === 'all' || booking.property_id === propertyId))
  return <section className="admin-card space-y-4 overflow-x-auto"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-extrabold">Availability calendar</h3><p className="text-sm text-neutral-500">Confirmed stays indicate dates that are reserved. Pause a listing under Properties to stop new bookings.</p></div><div className="flex gap-2"><input aria-label="Calendar month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="form-input" /><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="form-input"><option value="all">All properties</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
    {filtered.length ? <table className="admin-table"><thead><tr><th>Property</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>{filtered.map((b) => <tr key={b.id}><td>{b.property_name}</td><td>{b.first_name} {b.last_name}</td><td>{formatDate(b.check_in_date)}</td><td>{formatDate(b.check_out_date)}</td><td><span className={`status-badge status-${b.status}`}>{b.status.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table> : <p className="py-5 text-sm text-neutral-500">No confirmed stays overlap this month.</p>}
  </section>
}

function RoomServices({ services, guestRequests = [], onUpdate, onUpdateGuest }) {
  return <section className="admin-card space-y-4 overflow-x-auto"><div><h3 className="font-extrabold">Guest room services</h3><p className="text-sm text-neutral-500">Review cleaning, laundry, transfers, and other requested services.</p></div>
    {services.length ? <table className="admin-table"><thead><tr><th>Service</th><th>Guest</th><th>Property</th><th>Stay</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{services.map((service) => <tr key={service.id}><td>{service.service_name} × {service.quantity}</td><td>{service.first_name} {service.last_name}</td><td>{service.property_name}</td><td>{formatDate(service.check_in_date)} – {formatDate(service.check_out_date)}</td><td>{money(Number(service.unit_price) * Number(service.quantity))}</td><td><span className={`status-badge status-${service.status}`}>{service.status}</span></td><td className="flex gap-2">{service.status === 'pending' && <><button onClick={() => onUpdate(service.id, 'approved')} className="btn-primary text-xs">Approve</button><button onClick={() => onUpdate(service.id, 'declined')} className="btn-secondary text-xs">Decline</button></>}{service.status === 'approved' && <button onClick={() => onUpdate(service.id, 'fulfilled')} className="btn-primary text-xs">Mark complete</button>}</td></tr>)}</tbody></table> : <p className="py-5 text-sm text-neutral-500">No guest service requests found.</p>}
    <section className="admin-card space-y-4 overflow-x-auto"><div><h3 className="font-extrabold">In-stay guest orders</h3><p className="text-sm text-neutral-500">Food delivery, rides, cleaning, and laundry requests for your properties.</p></div>
      {guestRequests.length ? <table className="admin-table"><thead><tr><th>Service</th><th>Guest</th><th>Details / Location</th><th>Status</th><th>Action</th></tr></thead><tbody>{guestRequests.map((request) => <tr key={request.id}><td className="capitalize">{request.service_type}</td><td>{request.first_name} {request.last_name}</td><td style={{ whiteSpace: 'normal' }}>{request.request_details}{request.service_type === 'transport' ? <span className="block text-xs text-neutral-500">{request.pickup_location} → {request.destination}</span> : <span className="block text-xs text-neutral-500">{request.service_location}</span>}</td><td><span className={`status-badge status-${request.status}`}>{request.status}</span></td><td className="flex gap-2">{request.status === 'requested' && <><button onClick={() => onUpdateGuest(request.id, 'accepted')} className="btn-primary text-xs">Accept</button><button onClick={() => onUpdateGuest(request.id, 'declined')} className="btn-secondary text-xs">Decline</button></>}{request.status === 'accepted' && <button onClick={() => onUpdateGuest(request.id, 'in_progress')} className="btn-primary text-xs">Start</button>}{request.status === 'in_progress' && <button onClick={() => onUpdateGuest(request.id, 'completed')} className="btn-primary text-xs">Complete</button>}</td></tr>)}</tbody></table> : <p className="py-4 text-sm text-neutral-500">No in-stay guest orders yet.</p>}
    </section>
  </section>
}

function Finances({ payments, monthlyRevenue, stats }) {
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><div className="admin-card"><Value label="Paid this month" value={money(stats.monthly_revenue)} /></div><div className="admin-card"><Value label="Payment records" value={payments.length} /></div><div className="admin-card"><Value label="Pending payment amount" value={money(payments.filter((p) => ['pending', 'partially_paid'].includes(p.status)).reduce((sum, p) => sum + Number(p.amount), 0))} /></div></div>
    <section className="admin-card space-y-4 overflow-x-auto"><h3 className="font-extrabold">Monthly paid revenue</h3>{monthlyRevenue.length ? <table className="admin-table"><thead><tr><th>Month</th><th>Successful payments</th><th>Paid amount</th></tr></thead><tbody>{monthlyRevenue.map((row) => <tr key={row.month}><td>{row.month}</td><td>{row.payment_count}</td><td>{money(row.revenue)}</td></tr>)}</tbody></table> : <p className="text-sm text-neutral-500">No paid revenue recorded in this period.</p>}</section>
    <section className="admin-card space-y-4 overflow-x-auto"><h3 className="font-extrabold">Payment history</h3>{payments.length ? <table className="admin-table"><thead><tr><th>Date</th><th>Property</th><th>Stay</th><th>Method</th><th>Reference</th><th>Status</th><th>Amount</th></tr></thead><tbody>{payments.map((p) => <tr key={p.id}><td>{formatDate(p.created_at)}</td><td>{p.property_name}</td><td>{formatDate(p.check_in_date)} – {formatDate(p.check_out_date)}</td><td>{p.method}</td><td>{p.transaction_ref || '—'}</td><td>{p.status}</td><td>{money(p.amount)}</td></tr>)}</tbody></table> : <p className="text-sm text-neutral-500">No payments recorded.</p>}</section>
  </div>
}

function Reviews({ reviews }) {
  return <section className="admin-card space-y-4 overflow-x-auto"><div className="flex items-center gap-2"><FaStar className="text-neutral-500" /><div><h3 className="font-extrabold">Guest reviews</h3><p className="text-sm text-neutral-500">Reviews for your properties, including their moderation status.</p></div></div>
    {reviews.length ? <table className="admin-table"><thead><tr><th>Property</th><th>Guest</th><th>Rating</th><th>Review</th><th>Status</th><th>Date</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td>{review.property_name}</td><td>{review.first_name} {review.last_name}</td><td>{'★'.repeat(Number(review.rating))}</td><td>{review.title && <strong>{review.title}: </strong>}{review.comment}</td><td>{review.status}</td><td>{formatDate(review.created_at)}</td></tr>)}</tbody></table> : <p className="py-5 text-sm text-neutral-500">No reviews yet.</p>}
  </section>
}

function PropertyEditor({ property, saving, onChange, onCancel, onSave }) {
  const update = (key, value) => onChange({ ...property, [key]: value })
  const addPhotos = async (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    const current = propertyImages(property)
    if (current.length + files.length > 8) return window.alert('A property can have up to 8 photos.')
    try {
      const images = [...current, ...await Promise.all(files.map(optimizePropertyImage))]
      if (images.reduce((total, image) => total + image.length, 0) > 8_000_000) throw new Error('Combined photo upload is too large. Remove a photo or choose smaller files.')
      onChange({ ...property, images, imageUrl: images[0] || '' })
    } catch (error) { window.alert(error.message || 'Unable to load those photos.') }
  }
  const removePhoto = (index) => {
    const images = propertyImages(property).filter((_image, imageIndex) => imageIndex !== index)
    onChange({ ...property, images, imageUrl: images[0] || '' })
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <form role="dialog" aria-modal="true" aria-labelledby="property-editor-title" onSubmit={onSave} className="max-h-[90vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded bg-white p-6 shadow-lg">
      <div><h3 id="property-editor-title" className="text-xl font-extrabold">{property.id ? 'Edit property listing' : 'Add a property listing'}</h3><p className="mt-1 text-sm text-neutral-500">Set the listing details, nightly rate, and guest capacity.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property name" required value={property.name} onChange={(value) => update('name', value)} />
        <label className="form-field"><span className="form-label">Property type</span><select required value={property.type} onChange={(event) => update('type', event.target.value)} className="form-input">{[['airbnb','Airbnb'],['one_bedroom','One bedroom'],['single_room','Single room'],['bedsitter','Bedsitter'],['bnb','Bed & breakfast']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <Field label="Street address" required value={property.address} onChange={(value) => update('address', value)} />
        <Field label="City" required value={property.city} onChange={(value) => update('city', value)} />
        <Field label="Country" value={property.country} onChange={(value) => update('country', value)} />
        <Field label="Nightly price (KES)" required type="number" min="1" step="0.01" value={property.pricePerNight} onChange={(value) => update('pricePerNight', value)} />
        <Field label="Weekly price (KES)" type="number" min="0" step="0.01" value={property.pricePerWeek} onChange={(value) => update('pricePerWeek', value)} />
        <Field label="Monthly price (KES)" type="number" min="0" step="0.01" value={property.pricePerMonth} onChange={(value) => update('pricePerMonth', value)} />
        <Field label="Guest capacity" type="number" min="1" value={property.capacity} onChange={(value) => update('capacity', value)} />
        <Field label="Bedrooms" type="number" min="0" value={property.bedrooms} onChange={(value) => update('bedrooms', value)} />
        <Field label="Bathrooms" type="number" min="0" value={property.bathrooms} onChange={(value) => update('bathrooms', value)} />
        <label className="form-field sm:col-span-2"><span className="form-label">Property photos (up to 8; first is the cover)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} className="form-input" /><div className="owner-photo-grid">{propertyImages(property).map((image, index) => <div key={`${index}-${image.slice(0, 24)}`}><img src={image} alt={`Property ${index + 1}`} /><span>{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span><button type="button" onClick={() => removePhoto(index)} aria-label={`Remove photo ${index + 1}`}>Remove</button></div>)}</div><small>Photos are resized before saving. Use a clear cover photo, then add room, kitchen, bathroom, and exterior views.</small></label>
        <Field label="Or use a cover image URL" value={property.imageUrl} onChange={(value) => update('imageUrl', value)} />
        <label className="form-field"><span className="form-label">Listing status</span><select value={property.status} onChange={(event) => update('status', event.target.value)} className="form-input"><option value="available">Available for booking</option><option value="inactive">Paused / inactive</option><option value="maintenance">Maintenance</option></select></label>
        <label className="form-field sm:col-span-2"><span className="form-label">Description</span><textarea rows="3" value={property.description || ''} onChange={(event) => update('description', event.target.value)} className="form-input" /></label>
      </div>
      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4"><button type="button" onClick={onCancel} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save listing'}</button></div>
    </form>
  </div>
}

function Field({ label, value, onChange, type = 'text', ...inputProps }) {
  return <label className="form-field"><span className="form-label">{label}</span><input {...inputProps} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="form-input" /></label>
}

function Value({ label, value }) {
  return <div><p className="text-xs font-semibold text-neutral-500">{label}</p><p className="mt-1 font-bold text-neutral-800">{value}</p></div>
}
