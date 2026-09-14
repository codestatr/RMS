import React from 'react'
import '../../styles/revenue-chart.css'

/**
 * Revenue Chart Component
 * Simple bar chart showing monthly revenue
 */
export default function RevenueChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="revenue-chart">
        <h2>Monthly Revenue</h2>
        <div className="empty-state">No data available</div>
      </div>
    )
  }

  // Find max value for scaling
  const normalizedData = data.map((item) => ({ ...item, revenue: Number(item.revenue) || 0 }))
  const maxValue = Math.max(...normalizedData.map((d) => d.revenue), 0)
  const scale = maxValue > 0 ? 100 / maxValue : 1

  return (
    <div className="revenue-chart">
      <h2>Monthly Revenue Trend</h2>
      <div className="chart-container">
        <div className="y-axis">
          <div className="y-label">KES {(maxValue / 1000).toFixed(1)}K</div>
          <div className="y-label">KES {((maxValue * 0.5) / 1000).toFixed(1)}K</div>
          <div className="y-label">KES 0</div>
        </div>

        <div className="chart-area">
          {data.length === 0 ? (
            <div className="no-data">No data to display</div>
          ) : (
            <div className="bars">
              {normalizedData.map((item, index) => (
                <div key={index} className="bar-group">
                  <div className="bar-wrapper">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(5, item.revenue * scale)}%`,
                      }}
                      title={`KES ${item.revenue.toLocaleString('en-KE')}`}
                    ></div>
                  </div>
                  <div className="bar-label">
                    {new Date(item.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chart-footer">
        <div className="stat">
          <span className="stat-label">Total:</span>
          <span className="stat-value">
            KES {normalizedData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString('en-KE')}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Average:</span>
          <span className="stat-value">
            KES {(normalizedData.reduce((sum, d) => sum + d.revenue, 0) / normalizedData.length).toLocaleString('en-KE')}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Highest:</span>
          <span className="stat-value">
            KES {Math.max(...normalizedData.map((d) => d.revenue), 0).toLocaleString('en-KE')}
          </span>
        </div>
      </div>
    </div>
  )
}
