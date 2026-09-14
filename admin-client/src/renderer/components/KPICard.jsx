import React from 'react'
import '../../styles/kpi-card.css'

/**
 * KPI Card Component
 * Displays a key performance indicator with value, trend, and icon
 */
export default function KPICard({ title, value, icon, trend, status = 'normal' }) {
  return (
    <div className={`kpi-card ${status}`}>
      <div className="kpi-header">
        <h3 className="kpi-title">{title}</h3>
        <span className="kpi-icon">{icon}</span>
      </div>

      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-trend">{trend}</div>
      </div>

      <div className="kpi-footer">
        <div className="status-indicator"></div>
      </div>
    </div>
  )
}
