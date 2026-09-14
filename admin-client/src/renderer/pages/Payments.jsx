import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FiPlus, FiSearch } from 'react-icons/fi'
import '../../styles/payments.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}`,
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
  const [searchTerm, setSearchTerm] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${API_URL}/payments?limit=100`, authConfig())
        const result = response.data?.data?.data || []
        setPayments(result)
        applyFilters(result, methodFilter, searchTerm)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching payments:', error)
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

  if (loading) {
    return <div className="loading-spinner">Loading payments...</div>
  }

  return (
    <div className="payments-container">
      {/* Stats */}
      <div className="payment-stats">
        <div className="stat-card">
          <span className="stat-label">Total Revenue</span>
          <span className="stat-value">${totalRevenue.toLocaleString()}</span>
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

        <button className="btn-primary">
          <FiPlus size={20} />
          Record Payment
        </button>
      </div>

      {/* Payments List */}
      <div className="payments-list">
        {filteredPayments.length === 0 ? (
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
    </div>
  )
}
