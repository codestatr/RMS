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
  FaSignInAlt,
  FaBroom,
  FaCalendarAlt,
  FaArrowRight,
  FaInfoCircle,
  FaReceipt,
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

const formatStayDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
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
  const resolvedUserRole = userRole || user?.role || 'admin';

  useEffect(() => {
    if (resolvedUserRole === 'cashier') return;
    loadDashboardData();
  }, [resolvedUserRole]);

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

  if (resolvedUserRole === 'cashier') {
    return <CashierPerformanceDashboard user={user} onNavigate={onNavigate} />;
  }

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
          <button onClick={() => onNavigate?.('reports')} className="btn-secondary">
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
          <div className="operations-heading">
            <h3>Front desk</h3>
            <p>Reservations, room status and availability.</p>
          </div>

          <nav className="shortcut-list" aria-label="Front desk actions">
            <button onClick={() => onNavigate?.('cashier_terminal')} className="dashboard-shortcut primary">
              <span className="shortcut-icon"><FaSignInAlt aria-hidden="true" /></span>
              <span className="shortcut-copy"><strong>Walk-in check-in</strong><small>Start a cashier booking</small></span>
              <FaArrowRight className="shortcut-arrow" aria-hidden="true" />
            </button>
            <button onClick={() => onNavigate?.('maintenance')} className="dashboard-shortcut">
              <span className="shortcut-icon"><FaBroom aria-hidden="true" /></span>
              <span className="shortcut-copy"><strong>Room readiness</strong><small>Review housekeeping status</small></span>
              <FaArrowRight className="shortcut-arrow" aria-hidden="true" />
            </button>
            <button onClick={() => onNavigate?.('calendar')} className="dashboard-shortcut">
              <span className="shortcut-icon"><FaCalendarAlt aria-hidden="true" /></span>
              <span className="shortcut-copy"><strong>Availability calendar</strong><small>Check units and dates</small></span>
              <FaArrowRight className="shortcut-arrow" aria-hidden="true" />
            </button>
          </nav>

          <div className="dashboard-tip">
            <FaInfoCircle aria-hidden="true" />
            <span>Walk-in bookings are saved to the central reservation database.</span>
          </div>
        </div>
      </div>

      <OperationsOverview userRole={resolvedUserRole} onNavigate={onNavigate} />

      {/* Recent Bookings Live Feed */}
      <div className="dashboard-panel reservations-panel">
        <div className="dashboard-panel-header">
          <div>
            <h3>Recent reservations</h3>
            <p>Latest bookings from the website and front desk</p>
          </div>
          <button
            onClick={() => onNavigate?.('bookings')}
            className="dashboard-link"
          >
            <span>All bookings</span><FaArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className="reservations-table-scroll">
          <table className="admin-table reservations-table">
            <colgroup>
              <col className="reservation-col-guest" />
              <col className="reservation-col-unit" />
              <col className="reservation-col-dates" />
              <col className="reservation-col-channel" />
              <col className="reservation-col-total" />
              <col className="reservation-col-status" />
            </colgroup>
            <thead>
              <tr>
                <th>Guest Name</th>
                <th>Property Unit</th>
                <th>Stay Dates</th>
                <th>Channel</th>
                <th>Total (KES)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && recentBookings.length === 0 && <tr><td className="reservation-empty" colSpan="6">Loading reservations…</td></tr>}
              {!loading && recentBookings.length === 0 && <tr><td className="reservation-empty" colSpan="6">No reservations recorded.</td></tr>}
              {recentBookings.map((b) => {
                const customerName = resolveGuestName(b);
                const status = String(b.status || 'pending').toLowerCase();
                const statusLabel = status.replaceAll('_', ' ');
                const checkIn = b.checkInDate || b.check_in_date;
                const checkOut = b.checkOutDate || b.check_out_date;

                return (
                  <tr key={b.id}>
                    <td className="reservation-guest">{customerName}</td>
                    <td className="reservation-unit">{b.propertyName || b.property_name || 'Rental Unit'}</td>
                    <td className="reservation-dates">
                      <span>{formatStayDate(checkIn)}</span>
                      <span className="reservation-date-separator">to</span>
                      <span>{formatStayDate(checkOut)}</span>
                    </td>
                    <td><span className="reservation-channel">{b.source || 'Website'}</span></td>
                    <td className="reservation-amount">KES {Number(b.totalAmount || b.total_amount || 0).toLocaleString()}</td>
                    <td><span className={`reservation-status ${status.replaceAll('_', '-')}`}>{statusLabel}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CashierPerformanceDashboard({ user, onNavigate }) {
  const [summary, setSummary] = useState({ monthlyRevenue: 0, monthlyTransactions: 0, monthlyBookings: 0, lifetimeRevenue: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const headers = { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` };
    Promise.all([
      axios.get(`${API_URL}/reports/dashboard`, { headers }),
      axios.get(`${API_URL}/payments`, { headers, params: { limit: 10 } }),
    ]).then(([summaryResponse, paymentsResponse]) => {
      if (cancelled) return;
      setSummary(summaryResponse.data?.data || {});
      setTransactions(paymentsResponse.data?.data?.data || []);
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load your cashier activity.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cards = [
    ['Collected this month', `KES ${Number(summary.monthlyRevenue || 0).toLocaleString()}`],
    ['Payments this month', Number(summary.monthlyTransactions || 0).toLocaleString()],
    ['Bookings handled this month', Number(summary.monthlyBookings || 0).toLocaleString()],
    ['Collected all time', `KES ${Number(summary.lifetimeRevenue || 0).toLocaleString()}`],
  ];

  return <div className="dashboard-page cashier-performance-page">
    <div className="dashboard-header">
      <div>
        <h2>My cashier performance</h2>
        <p>{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your account'}: revenue, bookings, and payments recorded under your account only.</p>
      </div>
      <div className="dashboard-header-actions">
        <button onClick={() => onNavigate?.('cashier_terminal')} className="btn-amber"><FaPlus /> New walk-in</button>
        <button onClick={() => onNavigate?.('cashier_txs')} className="btn-secondary"><FaReceipt /> My receipts</button>
      </div>
    </div>

    {error && <div className="login-error" role="alert">{error}</div>}
    <div className="dashboard-kpi-grid">
      {cards.map(([label, value]) => <div key={label} className="dashboard-kpi-card">
        <div className="dashboard-kpi-heading"><span>{label}</span><div className="dashboard-kpi-icon"><FaMoneyBillWave /></div></div>
        <div className="dashboard-kpi-body"><span className="dashboard-kpi-value">{loading ? '…' : value}</span></div>
      </div>)}
    </div>

    <OperationsOverview userRole="cashier" onNavigate={onNavigate} />

    <div className="dashboard-panel reservations-panel">
      <div className="dashboard-panel-header"><div><h3>My recent transactions</h3><p>Only payments issued by your cashier account.</p></div></div>
      <div className="reservations-table-scroll"><table className="admin-table reservations-table">
        <thead><tr><th>Guest</th><th>Property</th><th>Method</th><th>Amount (KES)</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          {!loading && transactions.length === 0 && <tr><td className="reservation-empty" colSpan="6">No payments recorded under your account yet.</td></tr>}
          {transactions.map((item) => <tr key={item.id}>
            <td className="reservation-guest">{item.customerName || 'Guest'}</td>
            <td className="reservation-unit">{item.propertyName || 'Rental Unit'}</td>
            <td><span className="reservation-channel">{String(item.method || 'unknown').replaceAll('_', ' ')}</span></td>
            <td className="reservation-amount">KES {Number(item.amount || 0).toLocaleString()}</td>
            <td>{formatStayDate(item.createdAt)}</td>
            <td><span className={`reservation-status ${String(item.status || '').replaceAll('_', '-')}`}>{item.status}</span></td>
          </tr>)}
        </tbody>
      </table></div>
    </div>
  </div>;
}

export function OperationsOverview({ userRole = 'admin', onNavigate }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isCashier = userRole === 'cashier';

  useEffect(() => {
    let cancelled = false;
    const token = sessionStorage.getItem('rms_admin_token') || '';
    const refresh = () => axios.get(`${API_URL}/reports/operations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (!cancelled) { setSnapshot(response.data?.data || null); setError(''); } })
      .catch((requestError) => { if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load today’s operations.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const groups = [
    { key: 'arrivals', title: 'Arrivals today', icon: <FaSignInAlt />, empty: 'No arrivals scheduled today.', action: 'bookings' },
    { key: 'departures', title: 'Departures today', icon: <FaExchangeAlt />, empty: 'No departures scheduled today.', action: 'bookings' },
    ...(!isCashier ? [{ key: 'outstandingBalances', title: 'Outstanding balances', icon: <FaMoneyBillWave />, empty: 'No outstanding balances.', action: 'bookings' }] : []),
    { key: 'roomReadiness', title: 'Room readiness alerts', icon: <FaBroom />, empty: 'All rooms are ready.', action: 'maintenance' },
    { key: 'guestRequests', title: 'Guest requests to action', icon: <FaUserCheck />, empty: 'No guest requests need attention.', action: 'hospitality' },
  ];

  return <section className="dashboard-operations" aria-labelledby="dashboard-operations-title">
    <div className="dashboard-operations-heading">
      <div><h3 id="dashboard-operations-title">Today’s operations</h3><p>Live work queue for arrivals, departures, rooms, and guest requests.</p></div>
      <span className="dashboard-operations-live"><i /> Live snapshot</span>
    </div>
    {error && <p className="dashboard-operations-error" role="alert">{error}</p>}
    <div className="dashboard-operations-grid">
      {groups.map((group) => {
        const items = snapshot?.[group.key] || [];
        return <article className="dashboard-operations-card" key={group.key}>
          <div className="dashboard-operations-card-heading"><span className="dashboard-operations-icon">{group.icon}</span><div><h4>{group.title}</h4><strong>{loading ? '…' : Number(snapshot?.counts?.[group.key] ?? items.length)}</strong></div></div>
          {loading ? <p className="dashboard-operations-empty">Loading…</p> : items.length ? <ul>
            {items.slice(0, 4).map((item) => <li key={item.id}>
              <span className="dashboard-operations-item-title">{item.guestName || item.name || item.service_name || 'Guest request'}</span>
              <span className="dashboard-operations-item-detail">
                {group.key === 'arrivals' || group.key === 'departures' ? item.property_name : null}
                {group.key === 'roomReadiness' ? `${item.name} · ${item.housekeeping_status || 'maintenance'}` : null}
                {group.key === 'guestRequests' ? [item.service_name, item.property_name, item.request_details || item.service_location || (item.pickup_location && item.destination ? `${item.pickup_location} → ${item.destination}` : '')].filter(Boolean).join(' · ') : null}
                {group.key === 'outstandingBalances' ? `${item.property_name} · KES ${Number(item.balance || 0).toLocaleString()}` : null}
              </span>
            </li>)}
          </ul> : <p className="dashboard-operations-empty">{group.empty}</p>}
          <button type="button" className="dashboard-operations-link" onClick={() => onNavigate?.(group.action)}>Open {group.action === 'hospitality' ? 'guest services' : group.action === 'maintenance' ? 'room board' : 'bookings'} <FaArrowRight /></button>
        </article>;
      })}
    </div>
  </section>;
}
