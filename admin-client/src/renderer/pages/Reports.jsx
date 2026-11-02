import React, { useEffect, useState } from 'react';
import {
  FaChartBar,
  FaFileExport,
  FaPrint,
} from 'react-icons/fa';
import axios from 'axios';
import { getBranding } from '../utils/branding';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getDateBounds(range) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (range === 'week') start.setDate(now.getDate() - 6);
  else if (range === 'month') start.setDate(1);
  else if (range === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start.setFullYear(now.getFullYear(), quarterStartMonth - 3, 1);
    end.setFullYear(now.getFullYear(), quarterStartMonth, 0);
  } else start.setMonth(0, 1);
  const asDate = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { startDate: asDate(start), endDate: asDate(end) };
}

export default function Reports() {
  const [dateRange, setDateRange] = useState('month'); // 'week' | 'month' | 'quarter' | 'year'
  const [branding, setBranding] = useState(getBranding);
  const [report, setReport] = useState({ revenue: [], payments: [], topProperties: [] });
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const updateBranding = () => setBranding(getBranding());
    window.addEventListener('rms:branding-changed', updateBranding);
    return () => window.removeEventListener('rms:branding-changed', updateBranding);
  }, []);

  const dateBounds = getDateBounds(dateRange);
  const printPeriod = `${dateBounds.startDate} to ${dateBounds.endDate}`;
  const brandInitials = branding.name.trim().replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CS';

  useEffect(() => {
    let cancelled = false;
    const headers = { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` };
    const params = { startDate: dateBounds.startDate, endDate: dateBounds.endDate };
    setReportLoading(true);
    setReportError('');
    Promise.all([
      axios.get(`${API_URL}/reports/revenue`, { headers, params }),
      axios.get(`${API_URL}/reports/payments`, { headers, params }),
      axios.get(`${API_URL}/reports/top-properties`, { headers, params: { ...params, limit: 10 } }),
    ]).then(([revenueResponse, paymentResponse, propertyResponse]) => {
      if (cancelled) return;
      setReport({
        revenue: revenueResponse.data?.data?.revenue || [],
        payments: paymentResponse.data?.data?.byMethod || [],
        topProperties: propertyResponse.data?.data || [],
      });
    }).catch((error) => {
      if (!cancelled) setReportError(error.response?.data?.error || 'Unable to load live financial reports.');
    }).finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [dateBounds.startDate, dateBounds.endDate]);

  const formatMoney = (value) => `KES ${Number(value || 0).toLocaleString()}`;
  const totalRevenue = report.revenue.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const transactionCount = report.payments.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const paymentTotal = report.payments.reduce((sum, row) => sum + Number(row.total || 0), 0);

  const handleExportCSV = () => {
    const branding = getBranding();
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    let csvContent = '\uFEFF';
    csvContent += `${escapeCsv(branding.name)}\n${escapeCsv('Revenue report')}\n${escapeCsv(`Period: ${printPeriod}`)}\n${escapeCsv(`Generated: ${new Date().toLocaleString()}`)}\n\n`;
    csvContent += 'Property Name,Category,Paid Revenue (KES),Paid Bookings,Payment Transactions\n';
    report.topProperties.forEach((p) => {
      csvContent += `${escapeCsv(p.name)},${escapeCsv(p.type)},${Number(p.revenue || 0)},${Number(p.booking_count || 0)},${Number(p.transaction_count || 0)}\n`;
    });

    const csvUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.setAttribute('href', csvUrl);
    const fileBrand = branding.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Business';
    link.setAttribute('download', `${fileBrand}_Revenue_Report_${dateBounds.startDate}_${dateBounds.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(csvUrl), 1000);
  };

  const handleExportPDF = async () => {
    const branding = getBranding();
    const { startDate, endDate } = getDateBounds(dateRange);
    const response = await axios.post(
      `${API_URL}/reports/export`,
      { reportType: 'financial', format: 'pdf', startDate, endDate, branding },
      {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      },
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    const safeBrand = branding.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Business';
    link.download = `${safeBrand}-Financial-Report-${startDate}-to-${endDate}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="reports-page space-y-6" style={{ '--report-accent': branding.brandColor }}>
      <header className="report-print-header">
        <div className="report-print-brand-band">
          {branding.logo
            ? <img src={branding.logo} alt={`${branding.name} logo`} className="report-print-logo" />
            : <div className="report-print-logo report-print-logo-fallback" aria-hidden="true">{brandInitials}</div>}
          <div className="report-print-brand-copy">
            <strong>{branding.name}</strong>
            <span>PROPERTY MANAGEMENT</span>
          </div>
          <div className="report-print-issued">
            <span>GENERATED</span>
            <strong>{new Date().toLocaleString()}</strong>
          </div>
        </div>
        <div className="report-print-title-row">
          <div>
            <h1>Financial &amp; Occupancy Report</h1>
            <p>Property revenue and payment summary · {printPeriod}</p>
          </div>
          <span className="report-print-currency">KES</span>
        </div>
      </header>
      {/* Header & Date Range Filter */}
      <div className="reports-toolbar">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
            <FaChartBar className="text-amber-500" /> Financial Analytics &amp; Occupancy Reports
          </h2>
          <p className="text-xs text-neutral-500">
            Export tax summaries, analyze payment channels, and audit rental revenue in KES.
          </p>
        </div>

        <div className="reports-actions">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="p-2 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Year to Date</option>
          </select>

          <button
            onClick={handleExportCSV}
            className="btn-amber text-xs font-bold whitespace-nowrap"
          >
            <FaFileExport /> Export CSV
          </button>
          <button onClick={handleExportPDF} className="btn-primary">
            <FaFileExport /> Export PDF
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs font-semibold whitespace-nowrap"
          >
            <FaPrint /> Print
          </button>
        </div>
      </div>

      {reportError && <div className="login-error" role="alert">{reportError}</div>}
      {reportLoading && <p className="text-sm text-neutral-500" role="status">Loading live report data…</p>}

      {/* Summary Highlights */}
      <div className="reports-summary-grid">
        <div className="admin-card reports-summary-card">
          <span className="report-summary-label">Paid revenue in selected period</span>
          <span className="report-summary-value">{formatMoney(totalRevenue)}</span>
          <span className="report-summary-note">Paid transactions in this period</span>
        </div>

        <div className="admin-card reports-summary-card">
          <span className="report-summary-label">Payment transactions</span>
          <span className="report-summary-value">{transactionCount.toLocaleString()}</span>
          <span className="report-summary-note">Across {report.payments.length} payment methods</span>
        </div>

        <div className="admin-card reports-summary-card">
          <span className="report-summary-label">Properties with paid revenue</span>
          <span className="report-summary-value">{report.topProperties.length.toLocaleString()}</span>
          <span className="report-summary-note">Properties with recorded payments in this period</span>
        </div>
      </div>

      {/* Top Performing Units Table */}
      <div className="admin-card space-y-4">
        <h3 className="font-extrabold text-sm text-neutral-900 pb-2 border-b border-neutral-100">
          Top Earning Accommodations &amp; Occupancy
        </h3>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Property Unit</th>
              <th>Category</th>
              <th>Bookings Count</th>
              <th>Paid bookings</th>
              <th>Paid revenue (KES)</th>
            </tr>
          </thead>
          <tbody>
            {report.topProperties.map((p) => (
              <tr key={p.id}>
                <td className="font-bold text-neutral-900">{p.name}{p.city ? ` · ${p.city}` : ''}</td>
                <td>
                  <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                    {p.type}
                  </span>
                </td>
                <td className="font-semibold text-neutral-800">{Number(p.booking_count || 0).toLocaleString()} reservations</td>
                <td className="font-black text-amber-700 text-sm">{formatMoney(p.revenue)}</td>
              </tr>
            ))}
            {!reportLoading && report.topProperties.length === 0 && <tr><td colSpan="4">No paid property revenue in this period.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Payment Gateway Distribution */}
      <div className="admin-card space-y-4">
        <h3 className="font-extrabold text-sm text-neutral-900 pb-2 border-b border-neutral-100">
          Payment Method Share &amp; Gateway Distribution
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {report.payments.map((gw) => {
            const percentage = paymentTotal ? Math.round((Number(gw.total || 0) / paymentTotal) * 100) : 0;
            return <div key={gw.method} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                <span className="text-xs truncate">{String(gw.method || 'Unknown').replaceAll('_', ' ')}</span>
              </div>
              <span className="text-base font-black text-neutral-900 block">{formatMoney(gw.total)}</span>
              <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-500">
                <span>{Number(gw.count || 0)} transactions · {percentage}%</span>
                <div className="w-16 bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            </div>
          })}
          {!reportLoading && report.payments.length === 0 && <p className="text-sm text-neutral-500">No paid transactions in this period.</p>}
        </div>
      </div>
      <footer className="report-print-footer">
        <strong>{branding.name}</strong>
        <span>Financial &amp; Occupancy Report · {printPeriod}</span>
        <span className="report-print-page-number" />
      </footer>
    </div>
  );
}
