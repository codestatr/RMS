import React, { useState, useEffect } from 'react'
import { FiPlus } from 'react-icons/fi'
import axios from 'axios'
import '../../styles/shifts.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const authConfig = () => ({
  headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
})

/**
 * Shifts Management Page
 * Manage cashier shifts and POS transactions
 */
export default function Shifts() {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentShift, setCurrentShift] = useState(null)
  const [closingBalance, setClosingBalance] = useState('')
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const fetchShifts = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${API_URL}/shifts?limit=100`, authConfig())
        const result = response.data?.data?.data || response.data?.data || []
        setShifts(result)
        setCurrentShift(result.find((s) => s.status === 'open') || null)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching shifts:', error)
        setLoading(false)
      }
    }

    fetchShifts()
  }, [])

  const handleStartShift = async () => {
    try {
      const response = await axios.post(`${API_URL}/shifts/open`, {
        openingBalance: 0,
        notes: 'Started from admin shift management',
      }, authConfig())
      const newShift = response.data?.data
      if (newShift) {
        setCurrentShift(newShift)
        setShifts((previous) => [newShift, ...previous])
      }
    } catch (error) {
      console.error('Error starting shift:', error)
    }
  }

  const handleEndShift = async () => {
    if (!currentShift) return
    if (closingBalance === '' || Number.isNaN(Number(closingBalance)) || Number(closingBalance) < 0) return
    setIsClosing(true)
    try {
      const response = await axios.post(`${API_URL}/shifts/${currentShift.id}/close`, {
        actualClosingBalance: parseFloat(closingBalance),
        notes: 'Closed from admin shift management',
      }, authConfig())
      const updatedShift = response.data?.data
      setCurrentShift(null)
      setClosingBalance('')
      setShifts((previous) => previous.map((s) => (s.id === currentShift.id ? updatedShift : s)))
    } catch (error) {
      console.error('Error ending shift:', error)
      window.alert(error.response?.data?.message || error.response?.data?.error || 'Unable to end shift. Check the backend connection.')
    } finally {
      setIsClosing(false)
    }
  }

  if (loading) {
    return <div className="loading-spinner">Loading shifts...</div>
  }

  return (
    <div className="shifts-container">
      {/* Current Shift Status */}
      <div className="current-shift-section">
        {currentShift ? (
          <div className="shift-card active">
            <div className="shift-info">
              <h3>Current Shift</h3>
              <p className="shift-time">
                Started: {(currentShift.openTime || currentShift.startTime) ? new Date(currentShift.openTime || currentShift.startTime).toLocaleTimeString() : '-'}
              </p>
              <p className="shift-balance">
                Opening Balance: KES {Number(currentShift.openingBalance || 0).toLocaleString()}
              </p>
            </div>
            <div className="admin-end-shift-form">
              <input
                type="number"
                min="0"
                value={closingBalance}
                onChange={(event) => setClosingBalance(event.target.value)}
                placeholder="Closing cash"
                aria-label="Closing cash balance"
              />
              <button className="btn-danger" onClick={handleEndShift} disabled={isClosing || closingBalance === ''}>
                {isClosing ? 'Closing...' : 'End Shift'}
              </button>
            </div>
          </div>
        ) : (
          <div className="shift-card empty">
            <p>No active shift</p>
            <button className="btn-primary" onClick={handleStartShift}>
              <FiPlus size={20} />
              Start New Shift
            </button>
          </div>
        )}
      </div>

      {/* Shift History */}
      <div className="shift-history">
        <h2>Shift History</h2>
        {shifts.length === 0 ? (
          <div className="empty-state">
            <p>No shifts recorded</p>
          </div>
        ) : (
          <table className="shifts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Opening Balance</th>
                <th>Closing Balance</th>
                <th>Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td>{(shift.openTime || shift.startTime) ? new Date(shift.openTime || shift.startTime).toLocaleDateString() : '-'}</td>
                  <td>{(shift.openTime || shift.startTime) ? new Date(shift.openTime || shift.startTime).toLocaleTimeString() : '-'}</td>
                  <td>
                    {(shift.closeTime || shift.endTime)
                      ? new Date(shift.closeTime || shift.endTime).toLocaleTimeString()
                      : 'Ongoing'}
                  </td>
                  <td className="amount font-bold">KES {Number(shift.openingBalance || 0).toLocaleString()}</td>
                  <td className="amount font-bold">
                    {(shift.actualClosingBalance ?? shift.closingBalance) !== null && (shift.actualClosingBalance ?? shift.closingBalance) !== undefined
                      ? `KES ${Number(shift.actualClosingBalance ?? shift.closingBalance).toLocaleString()}`
                      : '-'}
                  </td>
                  <td
                    className={`variance font-bold ${
                      (shift.discrepancy ?? shift.variance ?? 0) >= 0 ? 'positive' : 'negative'
                    }`}
                  >
                    {(shift.discrepancy ?? shift.variance) !== null && (shift.discrepancy ?? shift.variance) !== undefined
                      ? `KES ${Number(shift.discrepancy ?? shift.variance).toLocaleString()}`
                      : '-'}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        shift.status === 'open' ? 'status-open' : 'status-closed'
                      }`}
                    >
                      {shift.status}
                    </span>
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
