import React, { useState, useEffect } from 'react';
import {
  FaReceipt,
  FaSearch,
  FaPrint,
  FaTimes,
  FaMoneyBillWave,
  FaMobileAlt,
  FaCreditCard,
  FaFilePdf,
} from 'react-icons/fa';
import axios from 'axios';
import { getBranding } from '../../utils/branding';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const resolveGuestName = (booking = {}) => {
  const candidate =
    booking.customerName ||
    booking.guestName ||
    booking.customer_name ||
    booking.guest_name ||
    [booking.first_name || booking.firstName, booking.last_name || booking.lastName].filter(Boolean).join(' ') ||
    [booking.firstName, booking.lastName].filter(Boolean).join(' ') ||
    'Guest';

  return String(candidate || 'Guest').trim() || 'Guest';
};

export default function CashierTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [branding, setBranding] = useState(getBranding);

  useEffect(() => {
    loadTransactions();
    const refreshBranding = () => setBranding(getBranding());
    window.addEventListener('rms:branding-changed', refreshBranding);
    return () => window.removeEventListener('rms:branding-changed', refreshBranding);
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/payments`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      setTransactions(res.data?.data?.data || res.data?.data || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const term = search.toLowerCase();
    return (
      (t.receiptNumber || '').toLowerCase().includes(term) ||
      resolveGuestName(t).toLowerCase().includes(term) ||
      (t.propertyName || t.property_name || '').toLowerCase().includes(term) ||
      (t.method || '').toLowerCase().includes(term)
    );
  });

  const handleReprintReceipt = (transaction) => {
    setSelectedReceipt(transaction);
  };

  const downloadReceiptPdf = async () => {
    if (!selectedReceipt?.id) {
      window.alert('Select a recorded payment to download its receipt.');
      return;
    }
    try {
      const response = await axios.get(`${API_URL}/receipts/payment/${selectedReceipt.id}/pdf`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      const safeBrand = branding.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Business';
      link.href = url;
      link.download = `${safeBrand}-Receipt-${selectedReceipt.receiptNumber || selectedReceipt.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(`Receipt PDF could not be downloaded: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <div className="transactions-page pos-page">
      <div className="transactions-header">
        <div>
          <h2 className="transactions-title">
            <FaReceipt /> Cashier Transactions &amp; Receipts History
          </h2>
          <p className="transactions-subtitle">
            View all processed walk-in and online payments, and reprint official tax receipts in KES.
          </p>
        </div>

        <div className="transactions-search">
          <input
            type="text"
            placeholder="Search receipt #, guest, or method..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="transactions-search-input"
          />
          <FaSearch />
        </div>
      </div>

      <div className="transactions-card">
        <div className="transactions-table-wrap">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Guest Name</th>
              <th>Property Unit</th>
              <th>Payment Method</th>
              <th>Amount (KES)</th>
              <th>Date / Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="transactions-empty">
                  No transactions recorded.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const guestName = resolveGuestName(t);

                return (
                  <tr key={t.id}>
                    <td className="transaction-number">{t.receiptNumber || `REC-${t.id.slice(0, 8)}`}</td>
                    <td className="transaction-guest">{guestName}</td>
                    <td className="transaction-property">{t.propertyName || t.property_name || 'Rental Unit'}</td>
                  <td>
                    <span className={`transaction-method ${t.method || 'other'}`}>
                      {t.method === 'cash' ? (
                        <FaMoneyBillWave className="text-amber-500" />
                      ) : t.method === 'mpesa' ? (
                        <FaMobileAlt className="text-emerald-500" />
                      ) : (
                        <FaCreditCard className="text-sky-500" />
                      )}
                      {t.method} (KES)
                    </span>
                  </td>
                  <td className="transaction-amount">
                    KES {Number(t.amount || 0).toLocaleString()}
                  </td>
                  <td className="transaction-time">
                    {new Date(t.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <button
                      onClick={() => handleReprintReceipt(t)}
                      className="transaction-reprint"
                    >
                      <FaPrint size={11} className="text-amber-500" /> Reprint
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Reprint Receipt Modal */}
      {selectedReceipt && (
        <div className="receipt-modal-overlay">
          <div className="receipt-modal">
            <div className="receipt-modal-header">
              <h3>
                <FaReceipt /> Tax Receipt Reprint
              </h3>
              <button onClick={() => setSelectedReceipt(null)} className="receipt-modal-close">
                <FaTimes size={16} />
              </button>
            </div>

            <div className="receipt-slip" style={{ '--receipt-accent': branding.brandColor }}>
              <div className="receipt-slip-header">
                {branding.logo && <img src={branding.logo} alt={`${branding.name} logo`} className="receipt-slip-logo" />}
                <h4>{branding.name}</h4>
                <p>WALK-IN BOOKING RECEIPT · KES</p>
                <p>{selectedReceipt.receiptNumber || 'REC-OFFICIAL'}</p>
              </div>

              <div className="receipt-line">
                <span>Guest:</span>
                <strong>{resolveGuestName(selectedReceipt) || 'Walk-in Guest'}</strong>
              </div>
              <div className="receipt-line">
                <span>Property:</span>
                <strong>{selectedReceipt.propertyName}</strong>
              </div>
              <div className="receipt-line">
                <span>Method:</span>
                <strong className="uppercase">{selectedReceipt.method} (KES)</strong>
              </div>
              <div className="receipt-line">
                <span>Cashier:</span>
                <strong>{selectedReceipt.issuedBy || selectedReceipt.cashierName || 'System / Online Gateway'}</strong>
              </div>

              <div className="receipt-total">
                <div>
                  <span>TOTAL PAID:</span>
                  <span>KES {Number(selectedReceipt.amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="receipt-modal-actions">
              <button
                onClick={() => window.print()}
                className="receipt-print-button"
              >
                <FaPrint /> Print Receipt
              </button>
              <button onClick={downloadReceiptPdf} className="receipt-pdf-button">
                <FaFilePdf /> Download PDF
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="receipt-close-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

