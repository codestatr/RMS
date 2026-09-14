import React, { useState } from 'react';
import {
  FaChartBar,
  FaFileExport,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaPercentage,
  FaMobileAlt,
  FaCreditCard,
  FaPrint,
} from 'react-icons/fa';
import axios from 'axios';
import { getBranding } from '../utils/branding';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Reports() {
  const [dateRange, setDateRange] = useState('month'); // 'week' | 'month' | 'quarter' | 'year'

  const topEarners = [
    { name: 'Ocean Breeze Beachfront Airbnb Villa', type: 'Airbnb Villa', revenue: 180000, bookings: 10, occupancy: '92%' },
    { name: 'Sunlight Luxury 1-Bedroom Apartment', type: 'One Bedroom', revenue: 99000, bookings: 18, occupancy: '86%' },
    { name: 'Amber Heights 1-Bedroom Penthouse', type: 'One Bedroom', revenue: 76000, bookings: 8, occupancy: '75%' },
    { name: 'Lakeview Executive Bed & Breakfast', type: 'BnB', revenue: 52000, bookings: 8, occupancy: '68%' },
    { name: 'Cozy Urban Bedsitter Studio', type: 'Bedsitter', revenue: 35000, bookings: 14, occupancy: '80%' },
  ];

  const paymentGatewayShare = [
    { method: 'M-Pesa Mobile Money (KES)', amount: 242000, percentage: 55, icon: <FaMobileAlt className="text-emerald-500" /> },
    { method: 'Cash / POS Drawer (KES)', amount: 110000, percentage: 25, icon: <FaMoneyBillWave className="text-amber-500" /> },
    { method: 'Credit / Debit Card (KES)', amount: 66000, percentage: 15, icon: <FaCreditCard className="text-sky-500" /> },
    { method: 'PayPal (USD Converted)', amount: 22000, percentage: 5, icon: <FaCreditCard className="text-indigo-500" /> },
  ];

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Property Name,Category,Total Revenue (KES),Bookings Count,Occupancy Rate\n';
    topEarners.forEach((p) => {
      csvContent += `"${p.name}","${p.type}",${p.revenue},${p.bookings},"${p.occupancy}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RMS_Revenue_Report_${dateRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    const branding = getBranding();
    const response = await axios.post(
      `${API_URL}/reports/export`,
      { reportType: 'financial', format: 'pdf', startDate: null, endDate: null, branding },
      {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      },
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RMS-Financial-Report-${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page space-y-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
            <FaChartBar className="text-amber-500" /> Financial Analytics &amp; Occupancy Reports
          </h2>
          <p className="text-xs text-neutral-500">
            Export tax summaries, analyze payment channels, and audit rental revenue in KES.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="p-2 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">This Month (September 2026)</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Year to Date (2026)</option>
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

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="admin-card">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Total Gross Bookings Revenue
          </span>
          <span className="text-2xl font-black text-neutral-900 block">KES 440,000</span>
          <span className="text-xs text-emerald-700 font-bold mt-1 block">+18.5% Growth</span>
        </div>

        <div className="admin-card">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Total 16% VAT Collected (KRA)
          </span>
          <span className="text-2xl font-black text-neutral-900 block">KES 70,400</span>
          <span className="text-xs text-neutral-500 mt-1 block">PIN: P051234567Z</span>
        </div>

        <div className="admin-card">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Average Stays Length
          </span>
          <span className="text-2xl font-black text-neutral-900 block">3.4 Nights</span>
          <span className="text-xs text-sky-700 font-bold mt-1 block">High turnover rate</span>
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
              <th>Occupancy Rate</th>
              <th>Gross Revenue (KES)</th>
            </tr>
          </thead>
          <tbody>
            {topEarners.map((p, idx) => (
              <tr key={idx}>
                <td className="font-bold text-neutral-900">{p.name}</td>
                <td>
                  <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                    {p.type}
                  </span>
                </td>
                <td className="font-semibold text-neutral-800">{p.bookings} reservations</td>
                <td className="font-bold text-sky-700">{p.occupancy}</td>
                <td className="font-black text-amber-700 text-sm">KES {p.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Gateway Distribution */}
      <div className="admin-card space-y-4">
        <h3 className="font-extrabold text-sm text-neutral-900 pb-2 border-b border-neutral-100">
          Payment Method Share &amp; Gateway Distribution
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paymentGatewayShare.map((gw, idx) => (
            <div key={idx} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                {gw.icon}
                <span className="text-xs truncate">{gw.method}</span>
              </div>
              <span className="text-base font-black text-neutral-900 block">KES {gw.amount.toLocaleString()}</span>
              <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-500">
                <span>Share: {gw.percentage}%</span>
                <div className="w-16 bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${gw.percentage}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
