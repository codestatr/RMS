import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaSun, FaMoneyBillWave, FaReceipt } from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function EndOfDay() {
  const [summary, setSummary] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    axios.get(`${API_URL}/end-of-day?date=${date}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
    }).then((response) => setSummary(response.data?.data || null)).catch((requestError) => {
      setSummary(null);
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message || 'Backend request failed');
    }).finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="end-of-day-page">
      <div className="admin-card end-of-day-header">
        <div>
          <h2><FaSun /> End-of-Day Summary</h2>
          <p>Review daily collections, payment channels, transactions, and cashier shifts.</p>
        </div>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      {loading ? <div className="admin-card end-of-day-message">Loading daily summary...</div> : summary ? (
        <>
          <div className="end-of-day-kpis">
            <div className="admin-card end-of-day-kpi"><span>Total Collected</span><strong>KES {Number(summary.totalRevenue || 0).toLocaleString()}</strong></div>
            <div className="admin-card end-of-day-kpi"><span>Transactions</span><strong>{summary.transactionCount || 0}</strong></div>
            <div className="admin-card end-of-day-kpi"><span>Cashier Shifts</span><strong>{summary.shifts?.length || 0}</strong></div>
          </div>
          <div className="admin-card end-of-day-section">
            <h3><FaMoneyBillWave /> Collections by Method</h3>
            <div className="end-of-day-methods">
              {Object.entries(summary.byMethod || {}).map(([method, amount]) => <div key={method}><span>{method.replaceAll('_', ' ')}</span><strong>KES {Number(amount).toLocaleString()}</strong></div>)}
              {Object.keys(summary.byMethod || {}).length === 0 && <p>No payment collections recorded for this date.</p>}
            </div>
          </div>
          <div className="admin-card end-of-day-section end-of-day-table-card">
            <h3><FaReceipt /> Shifts for {date}</h3>
            <div className="end-of-day-table-wrap"><table className="admin-table"><thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th>Opening Float</th><th>Status</th></tr></thead><tbody>{(summary.shifts || []).map((shift) => <tr key={shift.id}><td className="font-bold">{shift.cashierName}</td><td>{new Date(shift.open_time).toLocaleTimeString()}</td><td>{shift.close_time ? new Date(shift.close_time).toLocaleTimeString() : 'Open'}</td><td>KES {Number(shift.opening_balance || 0).toLocaleString()}</td><td className="uppercase font-bold">{shift.status}</td></tr>)}{(summary.shifts || []).length === 0 && <tr><td colSpan="5" className="end-of-day-empty">No cashier shifts recorded for this date.</td></tr>}</tbody></table></div>
          </div>
        </>
      ) : <div className="admin-card end-of-day-message end-of-day-error">The daily summary is unavailable: {error || 'Check the backend connection.'}</div>}
    </div>
  );
}
