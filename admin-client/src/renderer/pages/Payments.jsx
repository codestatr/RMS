import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FiPlus, FiSearch } from 'react-icons/fi'
import '../../styles/payments.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}`,
    },
  }
}

/**
 * Payments Management Page
 * Track and manage payment transactions
 */
export default function Payments() {
  const [payments, setPayments] = useState([])
  const [filteredPayments, setFilteredPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [bookingOptions, setBookingOptions] = useState([])
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transactionRef, setTransactionRef] = useState('')
  const [recordError, setRecordError] = useState('')
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true)
        let page = 1
        let totalPages = 1
        const result = []
        do {
          const response = await axios.get(`${API_URL}/payments`, {
            ...authConfig(),
            params: { page, limit: 100 },
          })
          const payload = response.data?.data
          result.push(...(Array.isArray(payload?.data) ? payload.data : []))
          totalPages = Math.max(1, Number(payload?.pagination?.pages) || 1)
          page += 1
        } while (page <= totalPages)
        setPayments(result)
        setLoadError('')
        applyFilters(result, methodFilter, searchTerm)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching payments:', error)
        setLoadError(error.response?.data?.message || error.response?.data?.error || 'Unable to load payments. Check your connection and sign-in session.')
        setLoading(false)
      }
    }

    fetchPayments()
    const interval = setInterval(fetchPayments, 10000)
    return () => clearInterval(interval)
  }, [])

  const applyFilters = (paymentsToFilter, method, search) => {
    let filtered = paymentsToFilter

    if (method !== 'all') {
      filtered = filtered.filter((p) => p.method === method)
    }

    if (search) {
      filtered = filtered.filter(
        (p) =>
          (p.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
          (p.propertyName || '').toLowerCase().includes(search.toLowerCase()) ||
          p.id.includes(search)
      )
    }

    setFilteredPayments(filtered)
  }

  useEffect(() => {
    applyFilters(payments, methodFilter, searchTerm)
  }, [searchTerm, methodFilter, payments])

  const getPaymentMethodIcon = (method) => {
    const icons = {
      card: '💳',
      mpesa: '📱',
      paypal: '🅿️',
      bank_transfer: '🏦',
      cash: '💵',
    }
    return icons[method] || '💰'
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid':
        return 'status-paid'
      case 'pending':
        return 'status-pending'
      case 'partially_paid':
        return 'status-partial'
      case 'refunded':
        return 'status-refunded'
      case 'failed':
        return 'status-failed'
      default:
        return 'status-default'
    }
  }

  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const openRecordPayment = async () => {
    setShowRecordModal(true)
    setLoadingBookings(true)
    setRecordError('')
    try {
      const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''
      const bookings = []
      let page = 1
      let totalPages = 1
      do {
        const response = await axios.get(`${API_URL}/bookings`, {
          params: { page, limit: 100 },
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = response.data?.data
        bookings.push(...(Array.isArray(result?.data) ? result.data : []))
        totalPages = Math.max(1, Number(result?.pagination?.pages) || 1)
        page += 1
      } while (page <= totalPages)

      const availableBookings = bookings.filter((booking) => {
        if (booking.status === 'cancelled') return false
        const paid = payments
          .filter((payment) => payment.bookingId === booking.id && ['paid', 'partially_paid'].includes(payment.status))
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
        return Number(booking.totalAmount || 0) - paid > 0.005
      })
      setBookingOptions(availableBookings)
      if (availableBookings.length) {
        const first = availableBookings[0]
        setSelectedBookingId(first.id)
        const paid = payments
          .filter((payment) => payment.bookingId === first.id && ['paid', 'partially_paid'].includes(payment.status))
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
        setPaymentAmount(String(Math.max(0, Number(first.totalAmount || 0) - paid)))
      } else {
        setRecordError('There are no bookings available for payment.')
      }
    } catch (error) {
      setRecordError(error.response?.data?.message || error.response?.data?.error || 'Unable to load bookings for payment.')
    } finally {
      setLoadingBookings(false)
    }
  }

  const handleBookingChange = (bookingId) => {
    setSelectedBookingId(bookingId)
    const booking = bookingOptions.find((item) => item.id === bookingId)
    const paid = payments
      .filter((payment) => payment.bookingId === bookingId && ['paid', 'partially_paid'].includes(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    setPaymentAmount(String(Math.max(0, Number(booking?.totalAmount || 0) - paid)))
  }

  const handleRecordPayment = async (event) => {
    event.preventDefault()
    setRecordError('')
    setSavingPayment(true)
    try {
      const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''
      const response = await axios.post(`${API_URL}/payments`, {
        bookingId: selectedBookingId,
        amount: Number(paymentAmount),
        method: paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } })
      const payment = response.data?.data
      if (payment) setPayments((items) => [payment, ...items])
      setShowRecordModal(false)
      setTransactionRef('')
    } catch (error) {
      setRecordError(error.response?.data?.message || error.response?.data?.error || 'Unable to record payment.')
    } finally {
      setSavingPayment(false)
    }
  }

  if (loading) {
    return <div className="loading-spinner">Loading payments...</div>
  }

  return (
    <div className="payments-container">
      {/* Stats */}
      <div className="payment-stats">
        <div className="stat-card">
          <span className="stat-label">Total Revenue</span>
          <span className="stat-value">KES {totalRevenue.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Payments</span>
          <span className="stat-value">{payments.filter((p) => p.status === 'pending').length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Transactions</span>
          <span className="stat-value">{payments.length}</span>
        </div>
      </div>

      {/* Header */}
      <div className="payments-header">
        <div className="search-bar">
          <FiSearch size={20} />
          <input
            type="text"
            placeholder="Search by customer, property, or payment ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-bar">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Methods</option>
            <option value="card">Card</option>
            <option value="mpesa">M-Pesa</option>
            <option value="paypal">PayPal</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        <button type="button" className="btn-primary" onClick={openRecordPayment}>
          <FiPlus size={20} />
          Record Payment
        </button>
      </div>

      {/* Payments List */}
      <div className="payments-list">
        {loadError ? (
          <div className="empty-state" role="alert"><p>{loadError}</p></div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">
            <p>No payments found</p>
          </div>
        ) : (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Booking ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="date">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </td>
                  <td className="customer">{payment.customerName || 'Unknown customer'}</td>
                  <td className="property">{payment.propertyName || 'Unknown property'}</td>
                  <td className="amount">KES {Number(payment.amount || 0).toLocaleString()}</td>
                  <td className="method">
                    <span className="method-badge">
                      {getPaymentMethodIcon(payment.method)} {payment.method}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(payment.status)}`}>
                      {payment.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="booking-id">{payment.bookingId?.slice(0, 8) || 'N/A'}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showRecordModal && (
        <div className="payment-modal-backdrop" onClick={() => !savingPayment && setShowRecordModal(false)}>
          <form className="payment-modal" onSubmit={handleRecordPayment} onClick={(event) => event.stopPropagation()}>
            <h2>Record a payment</h2>
            {recordError && <p className="payment-form-error" role="alert">{recordError}</p>}
            {loadingBookings ? <p>Loading bookings…</p> : <>
              <label>Booking
                <select required value={selectedBookingId} onChange={(event) => handleBookingChange(event.target.value)}>
                  <option value="" disabled>Select a booking</option>
                  {bookingOptions.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.customerName || 'Guest'} · {booking.propertyName || 'Property'} · {booking.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label>Amount (KES)
                <input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
              </label>
              <label>Payment method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="paypal">PayPal</option>
                </select>
              </label>
              <label>Transaction reference (optional)
                <input value={transactionRef} maxLength={120} onChange={(event) => setTransactionRef(event.target.value)} />
              </label>
            </>}
            <div className="payment-modal-actions">
              <button type="button" onClick={() => setShowRecordModal(false)} disabled={savingPayment}>Cancel</button>
              <button type="submit" disabled={loadingBookings || savingPayment || !bookingOptions.length}>
                {savingPayment ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
