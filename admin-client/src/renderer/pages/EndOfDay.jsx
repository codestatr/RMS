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
    <div className="space-y-6">
      <div className="admin-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2"><FaSun className="text-amber-500" /> End-of-Day Summary</h2>
          <p className="text-xs text-neutral-500 mt-1">Review daily collections, payment channels, transactions, and cashier shifts.</p>
        </div>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="p-2 border border-neutral-300 rounded-lg text-xs font-bold" />
      </div>

      {loading ? <div className="admin-card text-sm text-neutral-500">Loading daily summary...</div> : summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="admin-card"><span className="text-xs text-neutral-500 font-bold uppercase">Total Collected</span><strong className="block mt-2 text-2xl text-amber-700">KES {Number(summary.totalRevenue || 0).toLocaleString()}</strong></div>
            <div className="admin-card"><span className="text-xs text-neutral-500 font-bold uppercase">Transactions</span><strong className="block mt-2 text-2xl text-neutral-900">{summary.transactionCount || 0}</strong></div>
            <div className="admin-card"><span className="text-xs text-neutral-500 font-bold uppercase">Cashier Shifts</span><strong className="block mt-2 text-2xl text-sky-700">{summary.shifts?.length || 0}</strong></div>
          </div>
          <div className="admin-card">
            <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-2"><FaMoneyBillWave className="text-amber-500" /> Collections by Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {Object.entries(summary.byMethod || {}).map(([method, amount]) => <div key={method} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200"><span className="text-xs font-bold uppercase text-neutral-500">{method}</span><strong className="block mt-1 text-lg text-neutral-900">KES {Number(amount).toLocaleString()}</strong></div>)}
            </div>
          </div>
          <div className="admin-card overflow-x-auto">
            <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-2 mb-4"><FaReceipt className="text-amber-500" /> Shifts for {date}</h3>
            <table className="admin-table"><thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th>Opening Float</th><th>Status</th></tr></thead><tbody>{(summary.shifts || []).map((shift) => <tr key={shift.id}><td className="font-bold">{shift.cashierName}</td><td>{new Date(shift.open_time).toLocaleTimeString()}</td><td>{shift.close_time ? new Date(shift.close_time).toLocaleTimeString() : 'Open'}</td><td>KES {Number(shift.opening_balance || 0).toLocaleString()}</td><td className="uppercase font-bold">{shift.status}</td></tr>)}</tbody></table>
          </div>
        </>
      ) : <div className="admin-card text-sm text-rose-700">The daily summary is unavailable: {error || 'Check the backend connection.'}</div>}
    </div>
  );
}
