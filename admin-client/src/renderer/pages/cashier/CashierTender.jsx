import React, { useState } from 'react';
import {
  FaMoneyBillWave,
  FaMobileAlt,
  FaCreditCard,
  FaArrowLeft,
  FaCheckCircle,
  FaPrint,
  FaReceipt,
} from 'react-icons/fa';
import axios from 'axios';
import { getBranding } from '../../utils/branding';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function CashierTender({ bookingData, onBack, onComplete }) {
  const [method, setMethod] = useState('cash'); // 'cash' | 'mpesa' | 'card'
  const [tenderedAmount, setTenderedAmount] = useState(bookingData.totalAmount);
  const [transactionRef, setTransactionRef] = useState(`POS_CSH_${Date.now().toString().slice(-6)}`);
  const [mpesaPhone, setMpesaPhone] = useState(bookingData.guestPhone || '0712345678');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const branding = getBranding();
  const cashierUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('rms_admin_user') || '{}');
    } catch {
      return {};
    }
  })();
  const cashierDisplayName = [cashierUser.firstName, cashierUser.lastName].filter(Boolean).join(' ') || 'Cashier';

  const changeDue = Math.max(0, Number(tenderedAmount || 0) - bookingData.totalAmount);

  const handleSelectMethod = (m) => {
    setMethod(m);
    if (m === 'cash') {
      setTransactionRef(`POS_CSH_${Date.now().toString().slice(-6)}`);
    } else if (m === 'mpesa') {
      setTransactionRef(`MPESA_${Date.now().toString().slice(-8)}`);
    } else {
      setTransactionRef(`CARD_${Date.now().toString().slice(-8)}`);
    }
  };

  const handleExecutePayment = async () => {
    if (method === 'cash' && Number(tenderedAmount) < bookingData.totalAmount) {
      alert('Tendered cash amount is less than the total bill due.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Create Booking via API: a payment must always point to a real booking row.
      let bookingId = null;
      try {
        const bookRes = await axios.post(
          `${API_URL}/bookings`,
          {
            propertyId: bookingData.property.id,
            checkInDate: bookingData.checkInDate,
            checkOutDate: bookingData.checkOutDate,
            numberOfGuests: bookingData.guestCount,
            totalAmount: bookingData.totalBeforeDiscount || bookingData.totalAmount,
            discountAmount: bookingData.discountAmount || 0,
            specialRequests: bookingData.specialRequests,
            source: 'pos',
          },
          {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
          }
        );
        bookingId = bookRes.data?.data?.id || bookRes.data?.id;
      } catch (err) {
        const backendMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        console.error('Walk-in booking creation failed:', backendMessage);
        throw new Error(
          `Unable to create the booking on the backend. ${backendMessage}. Ensure the backend is running and you are authenticated.`
        );
      }

      if (!bookingId) {
        throw new Error('Unable to create the walk-in booking: backend did not return a valid booking ID.');
      }

      // 2. Create the payment record so the official PDF receipt has a payment ID.
      let createdPaymentId = null;
      try {
        const paymentRes = await axios.post(
          `${API_URL}/payments`,
          {
            bookingId,
            amount: bookingData.totalAmount,
            method,
            transactionRef,
          },
          { headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } },
        );
        createdPaymentId = paymentRes.data?.data?.id || paymentRes.data?.data?.paymentId || null;
        setPaymentId(createdPaymentId);
      } catch (err) {
        throw new Error(err.response?.data?.error || `Payment could not be recorded: ${err.message}`);
      }

      // 3. Build the immediate thermal preview.
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const receiptNo = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randSuffix}`;

      const generatedReceipt = {
        receiptNumber: receiptNo,
        bookingId,
        customerName: bookingData.guestName,
        customerPhone: bookingData.guestPhone,
        propertyName: bookingData.property.name,
        checkInDate: bookingData.checkInDate,
        checkOutDate: bookingData.checkOutDate,
        nights: bookingData.nights,
        subtotal: bookingData.subtotal,
        taxAmount: bookingData.vatTax,
        totalAmount: bookingData.totalAmount,
        remainingBalance: Math.max(0, Number(bookingData.totalAmount) - Number(tenderedAmount)),
        amountTendered: Number(tenderedAmount),
        changeDue,
        method: method.toUpperCase(),
        transactionRef,
        issuedAt: new Date().toLocaleString(),
        paymentId: createdPaymentId,
        cashierName: cashierDisplayName,
      };

      setReceipt(generatedReceipt);
    } catch (err) {
      alert('Error finalizing transaction: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (receipt) {
    const safeCustomer = receipt.customerName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Customer';
    const receiptFileName = `${safeCustomer}-${receipt.receiptNumber}.pdf`;

    const downloadReceipt = async () => {
      try {
        if (window.ipcRenderer) {
          const result = await window.ipcRenderer.invoke('receipt:save-pdf', { fileName: receiptFileName });
          if (result?.success || result?.canceled) return;
        }
      } catch (error) {
        console.warn('Native receipt save unavailable:', error);
      }

      if (!paymentId) {
        window.alert('The receipt is not linked to a server payment yet. Complete the payment while the backend is running, then download it again.');
        return;
      }

      try {
        const response = await axios.post(`${API_URL}/receipts/payment/${paymentId}/pdf`, { branding: { name: branding.name, logo: branding.logo } }, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        });
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = receiptFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        window.alert(`Unable to download the receipt PDF: ${error.response?.data?.message || error.message}`);
      }
    };

    const printReceipt = async () => {
      try {
        if (window.ipcRenderer) {
          const result = await window.ipcRenderer.invoke('receipt:print');
          if (result?.success || result?.canceled) return;
        }
      } catch (error) {
        console.warn('Native printing unavailable:', error);
      }
      window.print();
    };

    return (
      <div className="receipt-result-card">
        <div className="receipt-result-header">
          <div className="receipt-success-icon">
            <FaCheckCircle />
          </div>
          <h2>Walk-In Transaction Complete!</h2>
          <p>Official receipt generated and saved to shift ledger.</p>
        </div>

        {/* Thermal-style Receipt Layout */}
        <div className="thermal-receipt-preview" style={branding.logo ? { backgroundImage: `linear-gradient(rgba(248,250,252,.88), rgba(248,250,252,.88)), url(${branding.logo})`, backgroundPosition: 'center', backgroundSize: '145px', backgroundRepeat: 'no-repeat' } : undefined}>
          <div className="thermal-receipt-header">
            {branding.logo && <img src={branding.logo} alt={`${branding.name} logo`} className="thermal-receipt-logo" />}
            <h3>{branding.name}</h3>
            <p>PIN: P051234567Z | 16% VAT INC</p>
            <p>{receipt.receiptNumber}</p>
          </div>

          <div className="thermal-receipt-lines">
            <div><span>Guest</span><strong>{receipt.customerName}</strong></div>
            <div><span>Property</span><strong>{receipt.propertyName}</strong></div>
            <div><span>Stay Dates</span><strong>{receipt.checkInDate} to {receipt.checkOutDate}</strong></div>
            <div><span>Method</span><strong>{receipt.method} (KES)</strong></div>
            <div><span>Cashier</span><strong>{receipt.cashierName}</strong></div>
          </div>

          <div className="thermal-receipt-totals">
            <div><span>Subtotal</span><strong>KES {receipt.subtotal.toLocaleString()}</strong></div>
            <div><span>VAT (16%)</span><strong>KES {receipt.taxAmount.toLocaleString()}</strong></div>
            <div className="receipt-total-line"><span>TOTAL (KES)</span><strong>KES {receipt.totalAmount.toLocaleString()}</strong></div>
            <div><span>Tendered</span><strong>KES {receipt.amountTendered.toLocaleString()}</strong></div>
            <div><span>Balance Due</span><strong>KES {receipt.remainingBalance.toLocaleString()}</strong></div>
            {receipt.changeDue > 0 && <div className="change-line"><span>Change Returned</span><strong>KES {receipt.changeDue.toLocaleString()}</strong></div>}
          </div>
        </div>

        <div className="receipt-actions">
          <button
            onClick={downloadReceipt}
            className="receipt-pdf-button"
          >
            <FaReceipt /> Download PDF
          </button>
          <button
            onClick={printReceipt}
            className="receipt-print-button"
          >
            <FaPrint /> Print Receipt
          </button>
          <button
            onClick={onComplete}
            className="flex-1 btn-amber py-3 text-xs font-bold"
          >
            + Next Guest Booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-payment-page">
      <div className="pos-payment-header">
        <button
          onClick={onBack}
          className="pos-back-button"
        >
          <FaArrowLeft /> Back to Booking
        </button>
        <div>
          <h2>Collect Guest Payment (KES)</h2>
          <p>
            Select payment channel and enter tendered amount for <strong>{bookingData.guestName}</strong>
          </p>
        </div>
      </div>

      <div className="pos-payment-grid">
        {/* Left 2 Columns: Payment Method & Inputs */}
        <div className="pos-payment-main">
          {/* Method Selection Tabs */}
          <div className="payment-method-tabs">
            <button
              type="button"
              onClick={() => handleSelectMethod('cash')}
              className={`payment-method-tab cash ${
                method === 'cash'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              <FaMoneyBillWave size={22} className="text-amber-500" />
              <span>Cash (KES)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectMethod('mpesa')}
              className={`payment-method-tab mpesa ${
                method === 'mpesa'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              <FaMobileAlt size={22} className="text-emerald-600" />
              <span>M-Pesa (KES)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectMethod('card')}
              className={`payment-method-tab card ${
                method === 'card'
                  ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              <FaCreditCard size={22} className="text-sky-600" />
              <span>Card (PDQ/POS)</span>
            </button>
          </div>

          {/* Cash Tender Panel */}
          {method === 'cash' && (
            <div className="pos-payment-panel">
              <h3>Cash Drawer Tender</h3>
              
              <div>
                <label>Amount Tendered / Received (KES)</label>
                <input
                  type="number"
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  className="payment-amount-input"
                />
              </div>

              {/* Quick Cash Buttons in KES */}
              <div>
                <label className="quick-values-label">Quick Cash Values (KES)</label>
                <div className="quick-values">
                  <button
                    type="button"
                    onClick={() => setTenderedAmount(bookingData.totalAmount)}
                    className="quick-value-button"
                  >
                    Exact (KES {bookingData.totalAmount.toLocaleString()})
                  </button>
                  {[1000, 2000, 5000, 10000, 20000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTenderedAmount(val)}
                      className="quick-value-button"
                    >
                      KES {val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Change Box */}
              <div className="change-due-box">
                <span>Change Due to Guest:</span>
                <strong>KES {changeDue.toLocaleString()}</strong>
              </div>
            </div>
          )}

          {/* M-Pesa Panel */}
          {method === 'mpesa' && (
            <div className="pos-payment-panel">
              <h3>M-Pesa Mobile Money Confirmation</h3>
              <div>
                <label>Guest Mobile Phone Number</label>
                <input
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label>M-Pesa Confirmation Code</label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* Card Panel */}
          {method === 'card' && (
            <div className="pos-payment-panel">
              <h3>Credit / Debit Card Terminal Entry</h3>
              <div>
                <label>PDQ Authorization / Ref Code</label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Review */}
        <div className="pos-payment-summary-column">
          <div className="pos-payment-summary">
            <h3>
              <FaReceipt className="text-amber-500" /> Transaction Summary
            </h3>

            <div className="payment-summary-lines">
              <div className="flex justify-between">
                <span>Guest:</span>
                <span className="font-bold text-neutral-900">{bookingData.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span>Unit:</span>
                <span className="font-bold text-neutral-900 line-clamp-1">{bookingData.property.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Stay:</span>
                <span>{bookingData.nights} Night(s)</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-extrabold text-neutral-900">
                <span>Amount Due:</span>
                <span className="text-amber-600">KES {bookingData.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleExecutePayment}
              disabled={isProcessing}
              className="pos-submit-button"
            >
              <FaCheckCircle /> {isProcessing ? 'Processing...' : 'Complete & Generate Receipt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

