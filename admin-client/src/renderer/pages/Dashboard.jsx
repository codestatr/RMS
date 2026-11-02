import React, { useState, useEffect } from 'react';
import {
  FaMoneyBillWave,
  FaCalendarCheck,
  FaBed,
  FaPercentage,
  FaPlus,
  FaExchangeAlt,
  FaArrowUp,
  FaChartLine,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaClock,
  FaUserCheck,
} from 'react-icons/fa';
import axios from 'axios';
import '../../styles/dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const resolveGuestName = (booking = {}) => {
  const candidate =
    booking.guestName ||
    booking.customerName ||
    booking.customer_name ||
    booking.guest_name ||
    [booking.first_name || booking.firstName, booking.last_name || booking.lastName].filter(Boolean).join(' ') ||
    [booking.firstName, booking.lastName].filter(Boolean).join(' ') ||
    'Guest';

  return String(candidate || 'Guest').trim() || 'Guest';
};

export default function Dashboard({ onNavigate, user, userRole }) {
  const [kpis, setKpis] = useState({
    monthlyRevenue: 0,
    activeBookings: 0,
    availableUnits: 0,
    occupancyRate: 0,
    avgDailyRate: 0,
  });

  const [recentBookings, setRecentBookings] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [userRole]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [bookRes, payRes, propRes, kpiRes] = await Promise.all([
        axios.get(`${API_URL}/bookings?limit=6`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        }),
        axios.get(`${API_URL}/payments?limit=10`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        }),
        axios.get(`${API_URL}/properties`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        }),
        axios.get(`${API_URL}/reports/dashboard`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        }),
      ]);

      const allBookings = bookRes.data?.data?.data || bookRes.data?.data || [];
      setRecentBookings(allBookings);

      const allProps = propRes.data?.data?.data || propRes.data?.data || [];
      const totalUnits = allProps.length;
      const occupied = allBookings.filter((b) => b.status === 'checked_in' || b.status === 'confirmed').length;
      const occRate = totalUnits ? Math.round((occupied / totalUnits) * 100) : 0;

      const liveKpis = kpiRes.data?.data || {};
      setKpis({
        monthlyRevenue: Number(liveKpis.totalRevenue || 0),
        activeBookings: Number(liveKpis.totalBookings || occupied || 0),
        availableUnits: Number(liveKpis.totalProperties ?? totalUnits),
        occupancyRate: Number(liveKpis.occupancyRate ?? occRate),
        avgDailyRate: Number(liveKpis.totalBookings ? liveKpis.totalRevenue / liveKpis.totalBookings : 0),
      });

    } catch {
      setRecentBookings([]);
      setCategoryBreakdown([]);
      setKpis({ monthlyRevenue: 0, activeBookings: 0, availableUnits: 0, occupancyRate: 0, avgDailyRate: 0 });
    } finally {
      setLoading(false);
    }
  };

  const resolvedUserRole = userRole || user?.role || 'admin';
  const roleLabel = resolvedUserRole === 'cashier' ? 'Cashier' : 'Administrator';

  return (
    <div className="dashboard-page">
      {/* Top Header & Quick Action Row */}
      <div className="dashboard-header">
        <div>
          <h2>{resolvedUserRole === 'cashier' ? 'Front-Desk Performance Dashboard' : 'Executive Performance Dashboard'}</h2>
          <p>
            Real-time analytics for short-term and long-term rental units in Kenya.
          </p>
        </div>

        <div className="dashboard-admin-identity">
          <span className="dashboard-admin-status" />
          <div className="dashboard-admin-copy">
            <span className="dashboard-admin-name">
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Staff Member'}
            </span>
            <span className="dashboard-admin-role">{roleLabel}</span>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <button
            onClick={() => onNavigate?.('cashier_terminal')}
            className="btn-amber"
          >
            <FaPlus /> New Walk-In Check-In
          </button>
          <button
            onClick={() => onNavigate?.('reports')}
            className="btn-secondary"
          >
            <FaChartLine /> Detailed Reports
          </button>
        </div>
      </div>

      {/* 4 Clean Analytical KPI Cards */}
      <div className="dashboard-kpi-grid">
        {/* Monthly Revenue */}
        <div className="dashboard-kpi-card revenue">
          <div className="dashboard-kpi-heading">
            <span>Monthly Revenue</span>
            <div className="dashboard-kpi-icon">
              <FaMoneyBillWave />
            </div>
          </div>
          <div className="dashboard-kpi-body">
            <span className="dashboard-kpi-value">
              KES {kpis.monthlyRevenue.toLocaleString()}
            </span>
            <span className="dashboard-kpi-trend positive">
              <FaArrowUp /> +14.2% vs last month
            </span>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="dashboard-kpi-card occupancy">
          <div className="dashboard-kpi-heading">
            <span>Occupancy Rate</span>
            <div className="dashboard-kpi-icon">
              <FaPercentage />
            </div>
          </div>
          <div className="dashboard-kpi-body">
            <div className="dashboard-kpi-value-row">
              <span className="dashboard-kpi-value">{kpis.occupancyRate}%</span>
              <span className="dashboard-kpi-note">({kpis.activeBookings}/{kpis.availableUnits} units)</span>
            </div>
            {/* Progress Bar */}
            <div className="dashboard-progress-track">
              <div
                className="dashboard-progress-fill"
                style={{ width: `${kpis.occupancyRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Active Bookings */}
        <div className="dashboard-kpi-card reservations">
          <div className="dashboard-kpi-heading">
            <span>Active Reservations</span>
            <div className="dashboard-kpi-icon">
              <FaCalendarCheck />
            </div>
          </div>
          <div className="dashboard-kpi-body">
            <span className="dashboard-kpi-value">{kpis.activeBookings} Stays</span>
            <span className="dashboard-kpi-note">3 arriving today</span>
          </div>
        </div>

        {/* Average Daily Rate (ADR) */}
        <div className="dashboard-kpi-card adr">
          <div className="dashboard-kpi-heading">
            <span>Average Daily Rate (ADR)</span>
            <div className="dashboard-kpi-icon">
              <FaBed />
            </div>
          </div>
          <div className="dashboard-kpi-body">
            <span className="dashboard-kpi-value">
              KES {kpis.avgDailyRate.toLocaleString()}
            </span>
            <span className="dashboard-kpi-note">per booked night</span>
          </div>
        </div>
      </div>

      {/* Mid Section: Category Breakdown + Front-Desk Shortcuts */}
      <div className="dashboard-analysis-grid">
        {/* Category Revenue Contribution */}
        <div className="dashboard-panel revenue-analysis">
          <div className="dashboard-panel-header">
            <div>
              <h3>Revenue Contribution by Category</h3>
              <p>Share of monthly booking sales across rental types</p>
            </div>
            <span className="analysis-total">
              KES {kpis.monthlyRevenue.toLocaleString()} Total
            </span>
          </div>

          <div className="revenue-breakdown-list">
            {categoryBreakdown.length === 0 && <p className="text-neutral-500">Category revenue data is unavailable.</p>}
            {categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="revenue-breakdown-row">
                <div className="revenue-row-labels">
                  <span>{cat.type}</span>
                  <span>
                    KES {cat.revenue.toLocaleString()}{' '}
                    <span className="text-neutral-400 font-normal">({cat.percentage}%)</span>
                  </span>
                </div>
                <div className="revenue-bar-track">
                  <div
                    className="revenue-bar-fill"
                    data-color={idx}
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Operations Portal */}
        <div className="dashboard-panel operations-panel">
          <div>
            <h3>
              Front-Desk POS Shortcuts
            </h3>
            <p>
              Quick access to front-desk POS operations and room management.
            </p>

            <div className="shortcut-list">
              <button
                onClick={() => onNavigate?.('cashier_terminal')}
                className="dashboard-shortcut primary"
              >
                <span>🛎️ Instant Walk-In Check-In</span>
                <span>&rarr;</span>
              </button>

              <button
                onClick={() => onNavigate?.('maintenance')}
                className="dashboard-shortcut"
              >
                <span>🧹 Housekeeping &amp; Room Readiness</span>
                <span>&rarr;</span>
              </button>

              <button
                onClick={() => onNavigate?.('calendar')}
                className="dashboard-shortcut"
              >
                <span>📅 Availability Matrix Grid</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>

          <div className="dashboard-tip">
            💡 <strong>Tip:</strong> All walk-ins processed through the cashier terminal are automatically synchronized with the central MySQL database.
          </div>
        </div>
      </div>

      {/* Recent Bookings Live Feed */}
      <div className="dashboard-panel reservations-panel">
        <div className="dashboard-panel-header">
          <div>
            <h3>Recent Guest Reservations</h3>
            <p>Live feed of reservations across Website and POS Cashier desk</p>
          </div>
          <button
            onClick={() => onNavigate?.('bookings')}
            className="dashboard-link"
          >
            View All Bookings &rarr;
          </button>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Guest Name</th>
              <th>Property Unit</th>
              <th>Stay Dates</th>
              <th>Channel</th>
              <th>Total Bill (KES)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && recentBookings.length === 0 && <tr><td colSpan="6">No reservations recorded.</td></tr>}
            {recentBookings.map((b) => {
              const customerName = resolveGuestName(b);

              return (
                <tr key={b.id}>
                  <td className="font-bold text-neutral-900">{customerName}</td>
                  <td className="text-neutral-700">{b.propertyName || b.property_name || 'Rental Unit'}</td>
                <td className="text-[11px] text-neutral-500">
                  {b.checkInDate || b.check_in_date} to {b.checkOutDate || b.check_out_date}
                </td>
                <td>
                  <span className="text-[10px] font-mono font-bold uppercase bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                    {b.source || 'website'}
                  </span>
                </td>
                <td className="font-black text-amber-700">
                  KES {Number(b.totalAmount || b.total_amount || 0).toLocaleString()}
                </td>
                <td>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                      b.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'checked_in'
                        ? 'bg-sky-100 text-sky-800'
                        : b.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {b.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
