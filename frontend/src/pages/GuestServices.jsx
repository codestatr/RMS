import React, { useEffect, useState } from 'react'
import { FaBroom, FaConciergeBell, FaCar, FaTshirt, FaUtensils } from 'react-icons/fa'
import api from '../services/api'
import toast from 'react-hot-toast'

const serviceLabels = { food: 'Food to my room', refreshments: 'Refreshments to my room', transport: 'Additional transport during my stay', laundry: 'Laundry', cleaning: 'Room cleaning', other: 'Other request' }
const serviceIcons = { food: <FaUtensils />, refreshments: <FaUtensils />, transport: <FaCar />, laundry: <FaTshirt />, cleaning: <FaBroom />, other: <FaConciergeBell /> }

export default function GuestServices({ bookings = [], phone = '' }) {
  const eligibleBookings = bookings.filter((booking) => ['confirmed', 'checked_in'].includes(booking.status))
  const [requests, setRequests] = useState([])
  const [cateringMenu, setCateringMenu] = useState([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState('')
  const [selectedMenu, setSelectedMenu] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [respondingImage, setRespondingImage] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState(phone)
  const [payingRequest, setPayingRequest] = useState('')
  const [serviceCheckout, setServiceCheckout] = useState(null)
  const [paymentDelayed, setPaymentDelayed] = useState(false)
  const [form, setForm] = useState({ bookingId: '', serviceType: 'food', details: '', foodItems: [{ name: '', quantity: 1 }], requestMenu: false, serviceLocation: 'Inside my room', pickupLocation: '', destination: '', requestedFor: '' })

  const loadRequests = async () => {
    try {
      const response = await api.get('/guest-services/mine')
      const rows = Array.isArray(response.data?.data) ? response.data.data : []
      setRequests(rows)
      const pending = rows.find((request) => request.payment_status === 'pending' && request.service_payment_checkout_id)
      if (pending) {
        setServiceCheckout((current) => current?.checkoutRequestId === pending.service_payment_checkout_id
          ? current
          : { requestId: pending.id, checkoutRequestId: pending.service_payment_checkout_id })
      } else {
        setServiceCheckout(null)
        setPaymentDelayed(false)
      }
    } catch (error) { toast.error(error.response?.data?.error || 'Unable to load your service requests.') }
    finally { setLoading(false) }
  }

  const loadCateringMenu = async () => {
    setMenuLoading(true)
    try {
      const response = await api.get('/guest-services/catering-menu', { params: { _refresh: Date.now() } })
      setCateringMenu(Array.isArray(response.data?.data) ? response.data.data : [])
      setMenuError('')
    } catch (error) {
      setMenuError(error.response?.data?.error || error.response?.data?.message || 'Could not load the catering menu. Refresh the page or contact the property team.')
    } finally { setMenuLoading(false) }
  }

  useEffect(() => {
    loadRequests()
    loadCateringMenu()
    const timer = window.setInterval(loadRequests, 20000)
    const menuTimer = window.setInterval(loadCateringMenu, 60000)
    return () => { window.clearInterval(timer); window.clearInterval(menuTimer) }
  }, [])

  useEffect(() => {
    if (!serviceCheckout?.checkoutRequestId) return undefined
    let elapsed = 0
    let active = true
    let pollBusy = false
    const poll = async () => {
      if (pollBusy) return false
      pollBusy = true
      try {
        const response = await api.get(`/payments/mpesa/status/${encodeURIComponent(serviceCheckout.checkoutRequestId)}`)
        if (!active) return true
        const status = response.data?.data?.status
        if (status === 'paid') {
          setServiceCheckout(null)
          setPaymentDelayed(false)
          toast.success('Your service payment is confirmed.')
          await loadRequests()
          return true
        }
        if (status === 'failed') {
          setServiceCheckout(null)
          setPaymentDelayed(false)
          toast.error('M-Pesa payment was not completed. You can try again.')
          await loadRequests()
          return true
        }
      } catch (error) { console.error('Service payment status check failed:', error) }
      finally { pollBusy = false }
      return false
    }
    const interval = window.setInterval(async () => {
      elapsed += 15
      if (await poll()) {
        window.clearInterval(interval)
      } else if (elapsed >= 120 && active) setPaymentDelayed(true)
    }, 15000)
    poll()
    return () => { active = false; window.clearInterval(interval) }
  }, [serviceCheckout])

  const submitRequest = async (event) => {
    event.preventDefault(); setSaving(true)
    try {
      const items = form.foodItems.filter((item) => item.name.trim() && Number(item.quantity) > 0)
      const menuItems = Object.entries(selectedMenu).filter(([, quantity]) => Number(quantity) > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity: Number(quantity) }))
      const isCateringOrder = ['food', 'refreshments'].includes(form.serviceType)
      if (isCateringOrder && items.length === 0 && menuItems.length === 0 && !form.requestMenu) {
        toast.error('Choose an available menu item, add a custom item, or ask Catering to send food photos.')
        setSaving(false)
        return
      }
      const details = isCateringOrder
        ? [form.requestMenu ? 'Please send photos of the currently available food and refreshments.' : '', items.map((item) => `${Number(item.quantity)} x ${item.name.trim()}`).join('\n'), form.details.trim() ? `Instructions: ${form.details.trim()}` : ''].filter(Boolean).join('\n')
        : form.details
      await api.post('/guest-services', { ...form, details, menuItems })
      toast.success(isCateringOrder ? 'Your food or refreshments order was sent to Catering.' : 'Your request was sent to the property team.')
      setForm((current) => ({ ...current, details: '', foodItems: [{ name: '', quantity: 1 }], requestMenu: false, pickupLocation: '', destination: '', requestedFor: '' }))
      setSelectedMenu({})
      await loadRequests()
    } catch (error) { toast.error(error.response?.data?.error || 'Unable to send your request.') }
    finally { setSaving(false) }
  }

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const respondToPhoto = async (request, image, decision) => {
    setRespondingImage(image.id)
    try {
      await api.patch(`/guest-services/mine/${request.id}/photos/${image.id}`, { decision })
      toast.success(decision === 'accepted' ? `${image.caption} accepted. Catering can prepare it.` : `${image.caption} declined.`)
      await loadRequests()
    } catch (error) { toast.error(error.response?.data?.error || 'Unable to save your food choice.') }
    finally { setRespondingImage('') }
  }
  const payForService = async (request) => {
    if (!mpesaPhone.trim()) { toast.error('Enter an M-Pesa phone number first.'); return }
    setPayingRequest(request.id)
    try {
      const response = await api.post(`/guest-services/${request.id}/payment/mpesa`, { phone: mpesaPhone })
      const payment = response.data?.data
      setPaymentDelayed(false)
      setServiceCheckout({ requestId: request.id, checkoutRequestId: payment.checkoutRequestId })
      toast.success(`M-Pesa prompt sent to ${mpesaPhone}. Enter your PIN to pay the service quote.`)
      await loadRequests()
    } catch (error) { toast.error(error.response?.data?.error || 'Unable to start service payment.') }
    finally { setPayingRequest('') }
  }
  const statusLabel = (status) => String(status || '').replaceAll('_', ' ')
  const localTimeMinimum = (() => { const date = new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000); return date.toISOString().slice(0, 16) })()

  return <section className="space-y-6">
    <header className="border-b border-neutral-100 pb-4"><span className="text-[10px] font-black tracking-[.16em] uppercase text-emerald-700">YOUR STAY, YOUR WAY</span><h2 className="mt-1 text-xl font-extrabold text-neutral-900">Guest services</h2><p className="mt-1 text-xs text-neutral-500">While staying at the property, order food and drinks to your room, request laundry or cleaning, or arrange a ride from any pickup point.</p></header>

    <section className="grid gap-3" aria-label="Available catering menu"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold text-neutral-900">Available food &amp; refreshments</h3><p className="mt-1 text-xs text-neutral-500">Browse the current menu. Select items and quantities in your food request below.</p></div><button type="button" disabled={menuLoading} onClick={loadCateringMenu} className="shrink-0 rounded-md border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 disabled:opacity-50">{menuLoading ? 'Refreshing…' : 'Refresh menu'}</button></div>{menuError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{menuError}</p> : menuLoading && !cateringMenu.length ? <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">Loading catering menu…</p> : cateringMenu.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{cateringMenu.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white"><img src={item.image_url} alt={item.item_name} loading="lazy" className="h-32 w-full object-cover" /><div className="p-3"><h4 className="text-sm font-bold text-neutral-900">{item.item_name}</h4>{item.description && <p className="mt-1 text-xs text-neutral-500">{item.description}</p>}</div></article>)}</div> : <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">The catering team has not added any available menu items yet.</p>}</section>

    {eligibleBookings.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">You need a confirmed or active reservation to request guest services. Your service history will remain available below.</div> : <form onSubmit={submitRequest} className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-neutral-700 sm:col-span-2">Reservation<select required value={form.bookingId} onChange={(event) => update('bookingId', event.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm"><option value="">Choose your stay</option>{eligibleBookings.map((booking) => <option value={booking.id} key={booking.id}>{booking.propertyName || booking.property_name} · {new Date(booking.checkInDate || booking.check_in_date).toLocaleDateString()}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-bold text-neutral-700 sm:col-span-2">Service<select value={form.serviceType} onChange={(event) => update('serviceType', event.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm">{Object.entries(serviceLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      {['food', 'refreshments'].includes(form.serviceType) ? <div className="grid gap-3 sm:col-span-2">
        <div><h3 className="text-sm font-extrabold text-neutral-900">Choose your food or refreshments</h3><p className="mt-1 text-xs text-neutral-500">Select items from the available menu and set quantities. Add a custom request or delivery instruction if needed. Catering will quote the separate service payment.</p></div>
        {cateringMenu.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{cateringMenu.map((item) => <label key={item.id} className={`flex items-center gap-3 rounded-lg border p-2 ${selectedMenu[item.id] ? 'border-emerald-500 bg-emerald-50' : 'border-neutral-200 bg-white'}`}><input type="checkbox" checked={Boolean(selectedMenu[item.id])} onChange={(event) => setSelectedMenu((current) => { const next = { ...current }; if (event.target.checked) next[item.id] = 1; else delete next[item.id]; return next })} /><img src={item.image_url} alt="" className="h-12 w-12 rounded-md object-cover" /><span className="min-w-0 flex-1"><strong className="block text-xs text-neutral-800">{item.item_name}</strong>{item.description && <small className="text-[11px] text-neutral-500">{item.description}</small>}</span>{selectedMenu[item.id] && <input aria-label={`Quantity of ${item.item_name}`} type="number" min="1" max="50" value={selectedMenu[item.id]} onChange={(event) => setSelectedMenu((current) => ({ ...current, [item.id]: event.target.value }))} className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm" />}</label>)}</div>}
        <label className="flex items-center gap-2 text-xs font-bold text-neutral-700"><input type="checkbox" checked={form.requestMenu} onChange={(event) => update('requestMenu', event.target.checked)} />Show me what is available (send food photos)</label>
        {form.foodItems.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-end gap-2">
          <label className="grid gap-1 text-xs font-bold text-neutral-700">Other food or drink<input required={!form.requestMenu && Object.keys(selectedMenu).length === 0 && index === 0} maxLength={120} value={item.name} onChange={(event) => setForm((current) => ({ ...current, foodItems: current.foodItems.map((food, foodIndex) => foodIndex === index ? { ...food, name: event.target.value } : food) }))} placeholder="Optional custom item" className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>
          <label className="grid gap-1 text-xs font-bold text-neutral-700">Qty<input required={Boolean(item.name.trim())} type="number" min="1" max="50" value={item.quantity} onChange={(event) => setForm((current) => ({ ...current, foodItems: current.foodItems.map((food, foodIndex) => foodIndex === index ? { ...food, quantity: event.target.value } : food) }))} className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>
          <button type="button" disabled={form.foodItems.length <= 1} onClick={() => setForm((current) => ({ ...current, foodItems: current.foodItems.filter((_food, foodIndex) => foodIndex !== index) }))} className="rounded-lg border border-neutral-300 px-3 py-2.5 text-xs font-bold text-neutral-600 disabled:opacity-40">Remove</button>
        </div>)}
        <button type="button" disabled={form.foodItems.length >= 12} onClick={() => setForm((current) => ({ ...current, foodItems: [...current.foodItems, { name: '', quantity: 1 }] }))} className="justify-self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">+ Add another item</button>
        <label className="grid gap-1 text-xs font-bold text-neutral-700">Dietary notes or delivery instructions<textarea rows={2} maxLength={1000} value={form.details} onChange={(event) => update('details', event.target.value)} placeholder="Optional: allergies, preparation, or when you’d like it delivered" className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>
      </div> : form.serviceType === 'transport' ? <>
        <p className="text-xs text-neutral-600 sm:col-span-2">This is additional transport during your stay, quoted and paid separately after login. Airport pickup arranged during booking remains part of your booking payment.</p>
        <label className="grid gap-1 text-xs font-bold text-neutral-700">Pickup from<input required maxLength={255} value={form.pickupLocation} onChange={(event) => update('pickupLocation', event.target.value)} placeholder="SGR station, airport, hotel, office…" className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>
        <label className="grid gap-1 text-xs font-bold text-neutral-700">Destination<input required maxLength={255} value={form.destination} onChange={(event) => update('destination', event.target.value)} placeholder="Where would you like to go?" className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>
        <label className="grid gap-1 text-xs font-bold text-neutral-700 sm:col-span-2">Pickup date and time<input required type="datetime-local" min={localTimeMinimum} value={form.requestedFor} onChange={(event) => update('requestedFor', event.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>
      </> : <label className="grid gap-1 text-xs font-bold text-neutral-700 sm:col-span-2">Service location<input maxLength={255} value={form.serviceLocation} onChange={(event) => update('serviceLocation', event.target.value)} placeholder="Inside my room" className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>}
      {!['food', 'refreshments', 'transport'].includes(form.serviceType) && <label className="grid gap-1 text-xs font-bold text-neutral-700 sm:col-span-2">What do you need?<textarea required rows={3} maxLength={2000} value={form.details} onChange={(event) => update('details', event.target.value)} placeholder={form.serviceType === 'laundry' ? 'Describe the laundry items and preferred collection time…' : form.serviceType === 'cleaning' ? 'Tell us which room or cleaning help you need…' : 'Add details for the property team…'} className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" /></label>}
      <div className="sm:col-span-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">{serviceIcons[form.serviceType]}{saving ? 'Sending…' : 'Place service request'}</button><p className="mt-2 text-[11px] text-neutral-500">The property team will confirm availability and any additional charges before proceeding.</p></div>
    </form>}

    <div><div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold text-neutral-900">Your service requests</h3><button type="button" onClick={loadRequests} className="text-xs font-bold text-emerald-700">Refresh</button></div>
      {loading ? <p className="text-sm text-neutral-500">Loading requests…</p> : requests.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">No service requests yet.</p> : <div className="grid gap-3">{requests.map((request) => <article key={request.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 p-4">
        <div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">{serviceIcons[request.service_type]}</span><div><strong className="text-sm text-neutral-900">{serviceLabels[request.service_type]}</strong><p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">{request.request_details}</p>{request.service_type === 'transport' && <p className="mt-1 text-xs text-neutral-500">{request.pickup_location} → {request.destination}{request.requested_for ? ` · ${new Date(request.requested_for).toLocaleString()}` : ''}</p>}{request.service_location && <p className="mt-1 text-xs text-neutral-500">Delivery: {request.service_location}</p>}<p className="mt-1 text-[11px] text-neutral-400">{request.property_name} · {new Date(request.created_at).toLocaleString()}</p>{request.staff_notes && <p className="mt-2 text-xs text-neutral-600">Team: {request.staff_notes}</p>}{request.response_images?.length > 0 && <><p className="mt-3 text-xs font-bold text-neutral-700">Review these food choices. Accept the items you want Catering to prepare.</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{request.response_images.map((image) => <figure className="overflow-hidden rounded-lg border border-neutral-200" key={image.id}><img src={image.image_url} alt={image.caption} className="h-28 w-full object-cover" /><figcaption className="px-2 py-1 text-[11px] font-semibold text-neutral-700">{image.caption}</figcaption>{!['in_progress', 'completed', 'declined'].includes(request.status) ? <div className="flex gap-1 p-2"><button type="button" disabled={respondingImage === image.id} onClick={() => respondToPhoto(request, image, 'accepted')} className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-extrabold disabled:opacity-50 ${image.guest_response === 'accepted' ? 'bg-emerald-700 text-white' : 'border border-emerald-200 text-emerald-800'}`}>{image.guest_response === 'accepted' ? 'Accepted' : 'Accept'}</button><button type="button" disabled={respondingImage === image.id} onClick={() => respondToPhoto(request, image, 'declined')} className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-extrabold disabled:opacity-50 ${image.guest_response === 'declined' ? 'bg-rose-600 text-white' : 'border border-rose-200 text-rose-700'}`}>{image.guest_response === 'declined' ? 'Declined' : 'Decline'}</button></div> : <p className="px-2 pb-2 text-[10px] font-bold text-neutral-500">{image.guest_response === 'accepted' ? 'Accepted for preparation' : image.guest_response === 'declined' ? 'Declined' : 'No choice recorded'}</p>}</figure>)}</div></>}</div></div>
        <div className="flex min-w-[190px] flex-col items-end gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${request.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : request.status === 'declined' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{statusLabel(request.status)}</span>{Number(request.quoted_amount) > 0 && <div className="grid w-full gap-2 rounded-lg bg-amber-50 p-3 text-right"><strong className="text-xs text-neutral-800">Separate service quote: KES {Number(request.quoted_amount).toLocaleString()}</strong>{request.payment_status === 'paid' ? <span className="text-xs font-bold text-emerald-700">Paid by M-Pesa{request.service_payment_receipt ? ` · ${request.service_payment_receipt}` : ''}</span> : request.payment_status === 'pending' || serviceCheckout?.requestId === request.id ? <><span className="text-xs font-bold text-amber-700">Waiting for M-Pesa confirmation…</span>{request.service_payment_note && <span className="text-[11px] text-amber-800">{request.service_payment_note}</span>}{paymentDelayed && serviceCheckout?.requestId === request.id && <span className="text-[11px] text-amber-800">Confirmation is delayed. We are still checking; you can refresh this page.</span>}</> : request.status === 'accepted' && <><input aria-label="M-Pesa phone number for service payment" type="tel" value={mpesaPhone} onChange={(event) => setMpesaPhone(event.target.value)} placeholder="M-Pesa phone number" className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs" /><button type="button" disabled={Boolean(payingRequest)} onClick={() => payForService(request)} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">{payingRequest === request.id ? 'Sending prompt…' : `Pay KES ${Number(request.quoted_amount).toLocaleString()} separately`}</button></>}</div>}{request.quoted_amount === 0 && <span className="text-xs font-bold text-emerald-700">No service charge</span>}</div>
      </article>)}</div>}
    </div>
  </section>
}
