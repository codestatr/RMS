import React from 'react';
import { formatKES, formatUSD } from '../utils/currency';
import '../styles/receipt.css';

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function displayDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function ReceiptPrint({ receipt }) {
  if (!receipt) return null;
  const billing = receipt.billing || {};
  const business = receipt.business || {};
  const isPaypal = String(billing.paymentMethod || '').toLowerCase() === 'paypal';
  const paidAmount = isPaypal
    ? `${formatUSD(billing.amountPaid)} (${formatKES(billing.amountPaid)} equivalent)`
    : formatKES(billing.amountPaid);

  return (
    <article className="website-receipt" aria-label="Payment receipt" style={{ '--receipt-accent': business.brandColor || '#176b52' }}>
      <header className="website-receipt-brand">
        {business.logo && <img className="website-receipt-logo" src={business.logo} alt={`${business.name || 'Business'} logo`} />}
        <div className="website-receipt-brand-copy">
          <h2>{business.name || 'CozyStay'}</h2>
          <p>ONLINE PAYMENT RECEIPT · {billing.currency || 'KES'}</p>
          {(business.phone || business.email) && <p>{[business.phone, business.email].filter(Boolean).join(' / ')}</p>}
        </div>
      </header>

      <section className="website-receipt-meta">
        <div><span>Receipt</span><strong>{receipt.receiptNumber || '—'}</strong></div>
        <div><span>Issued</span><strong>{displayDateTime(receipt.issuedAt)}</strong></div>
        <div><span>Status</span><strong>{billing.paymentStatus || 'Paid'}</strong></div>
      </section>

      <section className="website-receipt-details">
        <h3>GUEST</h3>
        <p>{receipt.customer?.name || '—'}</p>
        {receipt.customer?.email && <p>{receipt.customer.email}</p>}
        {receipt.customer?.phone && <p>{receipt.customer.phone}</p>}
      </section>

      <section className="website-receipt-details">
        <h3>STAY</h3>
        <p className="website-receipt-property">{receipt.property?.name || '—'}</p>
        {receipt.property?.address && <p>{receipt.property.address}</p>}
        <p>{displayDate(receipt.stay?.checkInDate)} — {displayDate(receipt.stay?.checkOutDate)}</p>
        {receipt.stay?.guests && <p>{receipt.stay.guests} guest{Number(receipt.stay.guests) === 1 ? '' : 's'}</p>}
      </section>

      <section className="website-receipt-details">
        <h3>PAYMENT</h3>
        <p>Method: {String(billing.paymentMethod || '—').replaceAll('_', ' ').toUpperCase()} ({billing.currency || 'KES'})</p>
        {billing.transactionRef && <p className="website-receipt-ref">Reference: {billing.transactionRef}</p>}
      </section>

      <section className="website-receipt-totals">
        <div><span>Subtotal</span><strong>{formatKES(billing.subtotal)}</strong></div>
        <div><span>Tax ({billing.taxRate || 'VAT'})</span><strong>{formatKES(billing.taxAmount)}</strong></div>
        <div><span>Booking total</span><strong>{formatKES(billing.bookingTotal)}</strong></div>
        <div className="website-receipt-total"><span>Payment received</span><strong>{paidAmount}</strong></div>
        {Number(billing.totalPaidToDate) > 0 && <div><span>Total paid to date</span><strong>{formatKES(billing.totalPaidToDate)}</strong></div>}
        {Number(billing.balanceRemaining) > 0 && <div className="website-receipt-balance"><span>Balance remaining</span><strong>{formatKES(billing.balanceRemaining)}</strong></div>}
      </section>

      <footer className="website-receipt-footer">
        <strong>Thank you for choosing {business.name || 'CozyStay'}.</strong>
        <span>Issued by {receipt.issuedBy || business.name || 'CozyStay'}</span>
        <span>Keep this receipt for your records.</span>
      </footer>
    </article>
  );
}
