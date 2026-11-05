import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { FaCheck, FaClock, FaUtensils } from 'react-icons/fa'
import { optimizePropertyImage } from '../utils/propertyImages'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const authConfig = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}` } })

export default function CateringPortal({ view = 'overview' }) {
  const [orders, setOrders] = useState([])
  const [walkinOrders, setWalkinOrders] = useState([])
  const [walkinDraft, setWalkinDraft] = useState({ guestName: '', phone: '', orderDetails: '', amount: '', paymentMethod: 'cash' })
  const [walkinReceipts, setWalkinReceipts] = useState({})
  const [savingWalkin, setSavingWalkin] = useState(false)
  const [sendingWalkinPrompt, setSendingWalkinPrompt] = useState('')
  const [checkingWalkinPayment, setCheckingWalkinPayment] = useState('')
  const [menu, setMenu] = useState([])
  const [drafts, setDrafts] = useState({})
  const [menuDraft, setMenuDraft] = useState({ itemName: '', description: '', imageUrl: '' })
  const [savingMenu, setSavingMenu] = useState(false)
  const [sendingPhotoFor, setSendingPhotoFor] = useState('')
  const [receiptDrafts, setReceiptDrafts] = useState({})
  const [verifyingPaymentFor, setVerifyingPaymentFor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    const [ordersResult, menuResult, walkinResult] = await Promise.allSettled([
      axios.get(`${API_URL}/guest-services`, authConfig()),
      axios.get(`${API_URL}/guest-services/catering-menu`, authConfig()),
      axios.get(`${API_URL}/guest-services/catering-walkins`, authConfig()),
    ])
    const getError = (result, fallback) => result.reason?.response?.data?.message || result.reason?.response?.data?.error || fallback

    if (ordersResult.status === 'fulfilled') setOrders(Array.isArray(ordersResult.value.data?.data) ? ordersResult.value.data.data : [])
    if (menuResult.status === 'fulfilled') setMenu(Array.isArray(menuResult.value.data?.data) ? menuResult.value.data.data : [])
    if (walkinResult.status === 'fulfilled') setWalkinOrders(Array.isArray(walkinResult.value.data?.data) ? walkinResult.value.data.data : [])

    const errors = []
    if (ordersResult.status === 'rejected') errors.push(getError(ordersResult, 'Unable to load catering orders.'))
    if (menuResult.status === 'rejected') errors.push(getError(menuResult, 'Unable to load catering food photos.'))
    if (walkinResult.status === 'rejected') errors.push(getError(walkinResult, 'Unable to load walk-in catering orders.'))
    setError(errors.join(' '))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
    const timer = setInterval(loadOrders, 10000)
    return () => clearInterval(timer)
  }, [loadOrders])

  async function updateOrder(order, status) {
    const draft = drafts[order.id] || {}
    try {
      await axios.patch(`${API_URL}/guest-services/${order.id}`, {
        status,
        quotedAmount: draft.amount ?? order.quoted_amount ?? '',
        staffNotes: draft.notes ?? order.staff_notes ?? '',
      }, authConfig())
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to update this catering order.')
    }
  }

  async function sendPhotos(order) {
    const selectedIds = drafts[order.id]?.menuItemIds ?? (order.response_images || []).map((image) => image.menu_item_id)
    try {
      await axios.patch(`${API_URL}/guest-services/${order.id}/photos`, { menuItemIds: selectedIds }, authConfig())
      window.alert('Food photos sent to the guest.')
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to send food photos.')
    }
  }

  async function sendMenuPhoto(order, item) {
    setSendingPhotoFor(`${order.id}:${item.id}`)
    try {
      await axios.patch(`${API_URL}/guest-services/${order.id}/photos`, { menuItemIds: [item.id] }, authConfig())
      window.alert(`${item.item_name} photo sent to the guest.`)
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to send this food photo.')
    } finally {
      setSendingPhotoFor('')
    }
  }

  async function verifyPayment(order) {
    const receiptNumber = String(receiptDrafts[order.id] || '').trim()
    if (!receiptNumber) return window.alert('Enter the M-Pesa receipt code shown in the guest payment confirmation.')
    if (!window.confirm(`Confirm that M-Pesa receipt ${receiptNumber} is visible in the payment confirmation before releasing this order to the kitchen.`)) return
    setVerifyingPaymentFor(order.id)
    try {
      await axios.post(`${API_URL}/guest-services/${order.id}/payment/verify`, { receiptNumber }, authConfig())
      window.alert('Receipt verified. Catering can now prepare this order.')
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to verify this M-Pesa receipt.')
    } finally { setVerifyingPaymentFor('') }
  }

  const setDraft = (id, field, value) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))
  const completedOrders = orders.filter((order) => ['completed', 'declined'].includes(order.status))
  const readyToPrepare = orders.filter((order) => order.status === 'accepted' && order.payment_status === 'paid')
  const inPreparation = orders.filter((order) => order.status === 'in_progress')
  const needsAttention = orders.filter((order) => order.status === 'requested' || (order.status === 'accepted' && order.payment_status !== 'paid'))
  const visibleOrders = view === 'orders'
    ? orders.filter((order) => ['requested', 'accepted'].includes(order.status))
    : view === 'kitchen'
      ? [...readyToPrepare, ...inPreparation]
      : view === 'history'
        ? completedOrders
        : []
  const viewHeading = {
    overview: ['Catering overview', 'Live summary of guest orders, payment status, and kitchen work.'],
    orders: ['Order requests', 'Quote, accept, and manage guest food and refreshments requests.'],
    kitchen: ['Kitchen queue', 'Paid orders ready to prepare and orders currently in preparation.'],
    menu: ['Menu & availability', 'Manage food photos and show guests which items are available.'],
    history: ['Order history', 'Completed and declined catering orders.'],
    walkins: ['Walk-in orders', 'Take food orders from guests who are not ordering through a room booking.'],
  }[view] || ['Catering overview', 'Live summary of guest orders, payment status, and kitchen work.']

  async function addMenuItem(event) {
    event.preventDefault()
    if (!menuDraft.imageUrl) return window.alert('Choose a food photo first.')
    setSavingMenu(true)
    try {
      await axios.post(`${API_URL}/guest-services/catering-menu`, menuDraft, authConfig())
      setMenuDraft({ itemName: '', description: '', imageUrl: '' })
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to add this menu item.')
    } finally {
      setSavingMenu(false)
    }
  }

  async function toggleAvailability(item) {
    try {
      await axios.patch(`${API_URL}/guest-services/catering-menu/${item.id}/availability`, { isAvailable: !item.is_available }, authConfig())
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to update menu availability.')
    }
  }

  async function selectMenuImage(event) {
    try {
      const imageUrl = await optimizePropertyImage(event.target.files?.[0])
      setMenuDraft((current) => ({ ...current, imageUrl }))
    } catch (requestError) {
      window.alert(requestError.message || 'Unable to process this food photo.')
    } finally {
      event.target.value = ''
    }
  }

  async function createWalkin(event) {
    event.preventDefault()
    setSavingWalkin(true)
    try {
      await axios.post(`${API_URL}/guest-services/catering-walkins`, walkinDraft, authConfig())
      setWalkinDraft({ guestName: '', phone: '', orderDetails: '', amount: '', paymentMethod: 'cash' })
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to create walk-in order.')
    } finally { setSavingWalkin(false) }
  }

  async function updateWalkin(order, action) {
    const receiptNumber = walkinReceipts[order.id] || ''
    if (action === 'payment' && order.payment_method === 'cash' && !window.confirm(`Confirm KES ${order.quoted_amount} cash received from ${order.guest_name}?`)) return
    try {
      await axios.patch(`${API_URL}/guest-services/catering-walkins/${order.id}`, { action, receiptNumber }, authConfig())
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to update this walk-in order.')
    }
  }

  async function sendWalkinMpesaPrompt(order) {
    setSendingWalkinPrompt(order.id)
    try {
      const response = await axios.post(`${API_URL}/guest-services/catering-walkins/${order.id}/payment/mpesa`, { phone: order.phone }, authConfig())
      window.alert(response.data?.data?.customerMessage || `M-Pesa prompt sent to ${order.phone}. Ask the guest to enter their PIN.`)
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to send the M-Pesa prompt.')
      await loadOrders()
    } finally { setSendingWalkinPrompt('') }
  }

  async function checkWalkinPayment(order) {
    if (!order.transaction_ref) return window.alert('The M-Pesa prompt has not been sent yet.')
    setCheckingWalkinPayment(order.id)
    try {
      const response = await axios.get(`${API_URL}/payments/mpesa/status/${encodeURIComponent(order.transaction_ref)}`, authConfig())
      const status = response.data?.data?.status
      if (status === 'paid') window.alert('M-Pesa payment confirmed. The order can now be prepared.')
      else if (status === 'failed') window.alert('M-Pesa payment was not completed. You can send another prompt.')
      else window.alert('Payment is still pending. Ask the guest to complete the M-Pesa prompt, then check again.')
      await loadOrders()
    } catch (requestError) {
      window.alert(requestError.response?.data?.message || requestError.response?.data?.error || 'Unable to check this M-Pesa payment.')
    } finally { setCheckingWalkinPayment('') }
  }

  return <main className="catering-portal">
    <header className="catering-portal-heading">
      <div className="catering-portal-icon"><FaUtensils /></div>
      <div><h2>{viewHeading[0]}</h2><p>{viewHeading[1]}</p></div>
      <span className="catering-order-count">{orders.filter((order) => !['completed', 'declined'].includes(order.status)).length} open</span>
    </header>
    {error && <div className="catering-error" role="alert">{error}</div>}
    {view === 'walkins' && <section className="catering-menu-panel">
      <div className="catering-menu-heading"><div><h3>New walk-in food order</h3><p>Take an order and confirm payment before sending it to the kitchen.</p></div></div>
      <form className="catering-walkin-form" onSubmit={createWalkin}>
        <input required maxLength={200} placeholder="Guest name" value={walkinDraft.guestName} onChange={(e) => setWalkinDraft({ ...walkinDraft, guestName: e.target.value })} />
        <input required={walkinDraft.paymentMethod === 'mpesa'} maxLength={30} type="tel" placeholder={walkinDraft.paymentMethod === 'mpesa' ? 'Guest M-Pesa phone number' : 'Phone (optional)'} value={walkinDraft.phone} onChange={(e) => setWalkinDraft({ ...walkinDraft, phone: e.target.value })} />
        <textarea required maxLength={2000} rows={2} placeholder="Order items and quantities" value={walkinDraft.orderDetails} onChange={(e) => setWalkinDraft({ ...walkinDraft, orderDetails: e.target.value })} />
        <input required type="number" min="1" step="1" placeholder="Total (KES)" value={walkinDraft.amount} onChange={(e) => setWalkinDraft({ ...walkinDraft, amount: e.target.value })} />
        <select value={walkinDraft.paymentMethod} onChange={(e) => setWalkinDraft({ ...walkinDraft, paymentMethod: e.target.value })}><option value="cash">Cash</option><option value="mpesa">M-Pesa</option></select>
        <button className="catering-button catering-button-primary" disabled={savingWalkin}>{savingWalkin ? 'Saving…' : 'Create order'}</button>
      </form>
      {walkinOrders.length === 0 ? <p className="catering-empty">No walk-in food orders yet.</p> : <div className="catering-order-list">{walkinOrders.map((order) => <article className="catering-order-card" key={order.id}>
        <div className="catering-order-main"><div className="catering-order-type"><FaUtensils /><span>Walk-in · {order.guest_name}</span><span className={`catering-status catering-status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span></div><pre className="catering-order-items">{order.order_details}</pre><div className="catering-order-meta"><strong>KES {Number(order.quoted_amount).toLocaleString()}</strong><span>{order.phone || 'No phone provided'}</span><span>{order.payment_method.toUpperCase()} · {order.payment_status}{order.receipt_number ? ` · ${order.receipt_number}` : ''}</span></div></div>
        <div className="catering-order-actions">{order.payment_status !== 'paid' && (order.payment_method === 'cash' ? <button className="catering-button catering-button-secondary" onClick={() => updateWalkin(order, 'payment')}>Confirm cash received</button> : <>
          {['unpaid', 'failed'].includes(order.payment_status) && <button disabled={sendingWalkinPrompt === order.id} className="catering-button catering-button-secondary" onClick={() => sendWalkinMpesaPrompt(order)}>{sendingWalkinPrompt === order.id ? 'Sending prompt…' : order.payment_status === 'failed' ? 'Retry M-Pesa prompt' : 'Send M-Pesa prompt'}</button>}
          {order.payment_status === 'pending' && <button disabled={checkingWalkinPayment === order.id} className="catering-button catering-button-secondary" onClick={() => checkWalkinPayment(order)}>{checkingWalkinPayment === order.id ? 'Checking…' : 'Check M-Pesa status'}</button>}
          {order.payment_status !== 'pending' && <><input maxLength={20} placeholder="Or verify receipt manually" value={walkinReceipts[order.id] || ''} onChange={(e) => setWalkinReceipts({ ...walkinReceipts, [order.id]: e.target.value.toUpperCase() })} /><button className="catering-button catering-button-secondary" onClick={() => updateWalkin(order, 'payment')}>Verify receipt</button></>}
        </>)}{order.status === 'accepted' && <button disabled={order.payment_status !== 'paid'} className="catering-button catering-button-primary" onClick={() => updateWalkin(order, 'start')}>Start preparing</button>}{order.status === 'in_progress' && <button className="catering-button catering-button-primary" onClick={() => updateWalkin(order, 'complete')}>Mark ready / delivered</button>}</div>
      </article>)}</div>}
    </section>}
    {view === 'overview' && <section className="catering-overview-grid" aria-label="Catering activity summary">
      <article><span>Needs attention</span><strong>{needsAttention.length}</strong><small>New requests or waiting for payment</small></article>
      <article><span>Ready for kitchen</span><strong>{readyToPrepare.length}</strong><small>Accepted and fully paid</small></article>
      <article><span>In preparation</span><strong>{inPreparation.length}</strong><small>Currently being prepared</small></article>
      <article><span>Completed</span><strong>{completedOrders.filter((order) => order.status === 'completed').length}</strong><small>Ready or delivered</small></article>
    </section>}
    {view === 'menu' && <section className="catering-menu-panel">
      <div className="catering-menu-heading"><div><h3>Available food &amp; refreshments</h3><p>Add photos of current items. Select photos in an order reply to send them to that guest.</p></div><span>{menu.filter((item) => item.is_available).length} available</span></div>
      <form className="catering-menu-form" onSubmit={addMenuItem}>
        <input required maxLength={120} aria-label="Food item name" placeholder="Item name" value={menuDraft.itemName} onChange={(event) => setMenuDraft((current) => ({ ...current, itemName: event.target.value }))} />
        <input maxLength={500} aria-label="Food item description" placeholder="Short description (optional)" value={menuDraft.description} onChange={(event) => setMenuDraft((current) => ({ ...current, description: event.target.value }))} />
        <label className="catering-photo-picker">{menuDraft.imageUrl ? 'Photo selected' : 'Choose photo'}<input required={!menuDraft.imageUrl} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectMenuImage} /></label>
        {menuDraft.imageUrl && <img className="catering-photo-preview" src={menuDraft.imageUrl} alt="Selected food preview" />}
        <button className="catering-button catering-button-primary" disabled={savingMenu}>{savingMenu ? 'Saving…' : 'Add menu item'}</button>
      </form>
      {menu.length > 0 ? <div className="catering-menu-grid">{menu.map((item) => <article className={`catering-menu-item ${item.is_available ? '' : 'is-unavailable'}`} key={item.id}>
        <img src={item.image_url} alt={item.item_name} /><div><strong>{item.item_name}</strong>{item.description && <span>{item.description}</span>}<small>{item.is_available ? 'Available' : 'Unavailable'}</small></div><button type="button" onClick={() => toggleAvailability(item)} className="catering-button catering-button-secondary">{item.is_available ? 'Mark unavailable' : 'Make available'}</button>
      </article>)}</div> : <p className="catering-menu-empty">No food photos are in the menu yet. Add an item and upload its photo above; it will appear here and in guest order replies.</p>}
    </section>}
    {['orders', 'kitchen', 'history'].includes(view) && (loading ? <p className="catering-empty">Loading catering orders…</p> : visibleOrders.length === 0 ? <p className="catering-empty">{view === 'orders' ? 'No new or unpaid catering orders.' : view === 'kitchen' ? 'No paid orders are waiting in the kitchen.' : 'No completed catering orders yet.'}</p> : <div className="catering-order-list">
      {visibleOrders.map((order) => {
        const draft = drafts[order.id] || {}
        return <article className="catering-order-card" key={order.id}>
          <div className="catering-order-main">
            <div className="catering-order-type"><FaUtensils /><span>{order.service_type === 'refreshments' ? 'Refreshments order' : 'Food order'}</span><span className={`catering-status catering-status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span></div>
            <pre className="catering-order-items">{order.request_details}</pre>
            <div className="catering-order-meta"><strong>{order.first_name} {order.last_name}</strong><span>{order.phone || order.email || 'No guest contact'}</span><span>{order.property_name} · {order.service_location || 'Inside the room'}</span></div>
            <p className="catering-order-dates">Stay: {order.check_in_date} to {order.check_out_date}{order.requested_for ? ` · Requested ${new Date(order.requested_for).toLocaleString()}` : ''}</p>
          </div>
          <div className="catering-order-controls">
            <label>Quote (KES)<input type="number" min="0" step="1" placeholder="Enter before accepting" disabled={['pending', 'paid'].includes(order.payment_status)} value={draft.amount ?? order.quoted_amount ?? ''} onChange={(event) => setDraft(order.id, 'amount', event.target.value)} /></label>
            {Number(order.quoted_amount) > 0 && <small className="catering-payment-status">Separate service payment: {order.payment_status || 'unpaid'}</small>}
            {order.status === 'accepted' && ['pending', 'failed'].includes(order.payment_status) && <div className="catering-manual-payment"><label>M-Pesa receipt code<input maxLength={20} value={receiptDrafts[order.id] || ''} onChange={(event) => setReceiptDrafts((current) => ({ ...current, [order.id]: event.target.value.toUpperCase() }))} placeholder="e.g. QWE12RTY89" /></label><small>Use after checking the guest's M-Pesa confirmation.</small><button type="button" className="catering-button catering-button-secondary" disabled={verifyingPaymentFor === order.id} onClick={() => verifyPayment(order)}>{verifyingPaymentFor === order.id ? 'Verifying…' : 'Verify receipt & allow cooking'}</button></div>}
            {order.status === 'accepted' && draft.amount !== undefined && String(draft.amount) !== String(order.quoted_amount ?? '') && <button type="button" className="catering-button catering-button-secondary" disabled={['pending', 'paid'].includes(order.payment_status)} onClick={() => updateOrder(order, 'accepted')}>Save updated quote</button>}
            <label>Reply / kitchen note<textarea maxLength={1000} rows={2} placeholder="Availability, preparation, or substitution note" value={draft.notes ?? order.staff_notes ?? ''} onChange={(event) => setDraft(order.id, 'notes', event.target.value)} /></label>
            <fieldset className="catering-share-menu"><legend>Send photos and wait for the guest's choice</legend>
              {menu.filter((item) => item.is_available || (order.response_images || []).some((image) => image.menu_item_id === item.id)).length === 0
                ? <span>Add available menu items above to share photos.</span>
                : menu.filter((item) => item.is_available || (order.response_images || []).some((image) => image.menu_item_id === item.id)).map((item) => {
                  const selectedIds = draft.menuItemIds ?? (order.response_images || []).map((image) => image.menu_item_id)
                  const photoResponse = (order.response_images || []).find((image) => image.menu_item_id === item.id)
                  return <div className="catering-share-item" key={item.id}><input type="checkbox" aria-label={`Include ${item.item_name} when sending the selected photos`} checked={selectedIds.includes(item.id)} disabled={!item.is_available && !selectedIds.includes(item.id)} onChange={(event) => setDraft(order.id, 'menuItemIds', event.target.checked ? [...selectedIds, item.id] : selectedIds.filter((id) => id !== item.id))} /><button className="catering-photo-send" type="button" title={`Send ${item.item_name} photo now`} aria-label={`Send ${item.item_name} photo to ${order.first_name}`} disabled={sendingPhotoFor === `${order.id}:${item.id}`} onClick={() => sendMenuPhoto(order, item)}><img src={item.image_url} alt="" /></button><span>{item.item_name}{photoResponse ? ` · Guest ${photoResponse.guest_response || 'pending'}` : ''}</span></div>
                })}
            </fieldset>
            <div className="catering-order-actions">
              {(draft.menuItemIds ?? (order.response_images || []).map((image) => image.menu_item_id)).length > 0 && <button className="catering-button catering-button-secondary" onClick={() => sendPhotos(order)}>Send photos to guest</button>}
              {order.status === 'requested' && <><button className="catering-button catering-button-primary" onClick={() => updateOrder(order, 'accepted')}><FaCheck /> Accept order</button><button className="catering-button catering-button-secondary" onClick={() => updateOrder(order, 'declined')}>Decline</button></>}
              {order.status === 'accepted' && <button className="catering-button catering-button-primary" disabled={!(Number(order.quoted_amount) > 0 && order.payment_status === 'paid') || (order.response_images?.length > 0 && !order.response_images.some((image) => image.guest_response === 'accepted'))} title={!(Number(order.quoted_amount) > 0 && order.payment_status === 'paid') ? 'Food must be paid in full before preparation starts' : order.response_images?.length > 0 && !order.response_images.some((image) => image.guest_response === 'accepted') ? 'Wait for the guest to accept at least one food photo' : 'Start preparing the accepted order'} onClick={() => updateOrder(order, 'in_progress')}><FaUtensils /> Start preparing</button>}
              {order.status === 'in_progress' && <button className="catering-button catering-button-primary" onClick={() => updateOrder(order, 'completed')}><FaCheck /> Mark ready / delivered</button>}
              {['completed', 'declined'].includes(order.status) && <span className="catering-finished"><FaClock /> Order {order.status}</span>}
            </div>
          </div>
        </article>
      })}
    </div>)}
  </main>
}
