import React from 'react'
import { FiEye, FiCheck, FiX } from 'react-icons/fi'
import '../../styles/recent-bookings.css'

/**
 * Recent Bookings Component
 * Shows a table of recent bookings with quick actions
 */
export default function RecentBookings({ bookings = [], onAction }) {
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

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  }

  return (
    <div className="recent-bookings">
      {bookings.length === 0 ? (
        <div className="empty-state">
          <p>No recent bookings</p>
        </div>
      ) : (
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Guest Name</th>
              <th>Property</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="booking-id">{booking.id.slice(0, 8)}...</td>
                <td className="guest-name">{booking.guestName}</td>
                <td className="property-name">{booking.propertyName}</td>
                <td className="check-in">
                  {new Date(booking.checkInDate).toLocaleDateString()}
                </td>
                <td className="check-out">
                  {new Date(booking.checkOutDate).toLocaleDateString()}
                </td>
                <td className="amount">KES {Number(booking.totalAmount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </td>
                <td className="actions">
                  <button className="action-icon-btn" aria-label="View booking details" onClick={() => onAction(booking, 'view')}>
                    <FiEye size={16} />
                  </button>
                  {booking.status === 'confirmed' && (
                    <button className="action-icon-btn success" aria-label="Check in guest" onClick={() => onAction(booking, 'check-in')}>
                      <FiCheck size={16} />
                    </button>
                  )}
                  {booking.status === 'pending' && (
                    <button className="action-icon-btn danger" aria-label="Cancel booking" onClick={() => onAction(booking, 'cancel')}>
                      <FiX size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
