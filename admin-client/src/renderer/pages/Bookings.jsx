import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCheck, FiX } from 'react-icons/fi'
import '../../styles/bookings.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function authConfig() {
  return { headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } }
}

/**
 * Bookings Management Page
 * View, create, and manage bookings
 */
export default function Bookings({ onNewBooking }) {
  const [bookings, setBookings] = useState([])
  const [filteredBookings, setFilteredBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true)
        let page = 1
        let totalPages = 1
        const result = []
        do {
          const response = await axios.get(`${API_URL}/bookings`, {
            ...authConfig(),
            params: { page, limit: 100 },
          })
          const payload = response.data?.data
          result.push(...(Array.isArray(payload?.data) ? payload.data : []))
          totalPages = Math.max(1, Number(payload?.pagination?.pages) || 1)
          page += 1
        } while (page <= totalPages)
        setBookings(result)
        setLoadError('')
        applyFilters(result, statusFilter, searchTerm)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching bookings:', error)
        setLoadError(error.response?.data?.message || error.response?.data?.error || 'Unable to load bookings. Check your connection and sign-in session.')
        setLoading(false)
      }
    }

    fetchBookings()
    const interval = setInterval(fetchBookings, 10000)
    return () => clearInterval(interval)
  }, [])

  const applyFilters = (bookingsToFilter, status, search) => {
    let filtered = bookingsToFilter

    if (status !== 'all') {
      filtered = filtered.filter((b) => b.status === status)
    }

    if (search) {
      filtered = filtered.filter(
        (b) =>
          (b.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
          (b.propertyName || '').toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredBookings(filtered)
  }

  useEffect(() => {
    applyFilters(bookings, statusFilter, searchTerm)
  }, [searchTerm, statusFilter, bookings])

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed'
      case 'pending':
        return 'status-pending'
      case 'checked_in':
        return 'status-active'
      case 'checked_out':
        return 'status-completed'
      case 'cancelled':
        return 'status-cancelled'
      default:
        return 'status-default'
    }
  }

  const handleConfirmBooking = async (id) => {
    setActionError('')
    try {
      await axios.put(`${API_URL}/bookings/${id}`, { status: 'confirmed' }, authConfig())
      setBookings((items) => items.map((b) => (b.id === id ? { ...b, status: 'confirmed' } : b)))
    } catch (error) {
      console.error('Error confirming booking:', error)
      setActionError(error.response?.data?.message || error.response?.data?.error || 'Unable to confirm booking.')
    }
  }

  const handleCheckIn = async (id) => {
    setActionError('')
    try {
      await axios.put(`${API_URL}/bookings/${id}`, { status: 'checked_in' }, authConfig())
      setBookings((items) => items.map((b) => (b.id === id ? { ...b, status: 'checked_in' } : b)))
    } catch (error) {
      console.error('Error checking in:', error)
      setActionError(error.response?.data?.message || error.response?.data?.error || 'Unable to check in guest.')
    }
  }

  const handleCancelBooking = async (id) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      setActionError('')
      try {
        await axios.put(`${API_URL}/bookings/${id}`, { status: 'cancelled' }, authConfig())
        setBookings((items) => items.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
      } catch (error) {
        console.error('Error cancelling booking:', error)
        setActionError(error.response?.data?.message || error.response?.data?.error || 'Unable to cancel booking.')
      }
    }
  }

  if (loading) {
    return <div className="loading-spinner">Loading bookings...</div>
  }

  return (
    <div className="bookings-container">
      {/* Header */}
      <div className="bookings-header">
        <div className="search-bar">
          <FiSearch size={20} />
          <input
            type="text"
            placeholder="Search by guest name or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-bar">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button type="button" className="btn-primary" onClick={onNewBooking}>
          <FiPlus size={20} />
          New Booking
        </button>
      </div>

      {/* Bookings List */}
      {actionError && <div className="empty-state" role="alert"><p>{actionError}</p></div>}
      <div className="bookings-list">
        {loadError ? (
          <div className="empty-state" role="alert">
            <p>{loadError}</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="empty-state">
            <p>No bookings found</p>
          </div>
        ) : (
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Guest</th>
                <th>Property</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Guests</th>
                <th>Arrival / Pickup</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="booking-id">{booking.id.slice(0, 8)}...</td>
                  <td className="guest-name">{booking.customerName}</td>
                  <td className="property-name">{booking.propertyName}</td>
                  <td className="check-in">
                    {new Date(booking.checkInDate).toLocaleDateString()}
                  </td>
                  <td className="check-out">
                    {new Date(booking.checkOutDate).toLocaleDateString()}
                  </td>
                  <td className="guests">{booking.numberOfGuests}</td>
                  <td className="text-xs">
                    <span className="block">{booking.arrivalWindow || 'Arrival not set'}</span>
                    {booking.pickupLocation && <span className="block text-sky-700 font-semibold">Pickup: {booking.pickupLocation}</span>}
                  </td>
                  <td className="amount font-bold">KES {Number(booking.totalAmount || 0).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="actions">
                    {booking.status === 'pending' && (
                      <>
                        <button
                          className="action-btn success"
                          onClick={() => handleConfirmBooking(booking.id)}
                          title="Confirm"
                        >
                          <FiCheck size={16} />
                        </button>
                        <button
                          className="action-btn danger"
                          onClick={() => handleCancelBooking(booking.id)}
                          title="Cancel"
                        >
                          <FiX size={16} />
                        </button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <button
                        className="action-btn"
                        onClick={() => handleCheckIn(booking.id)}
                        title="Check In"
                      >
                        <FiCheck size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
