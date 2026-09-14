import React, { useState } from 'react';
import {
  FaClock,
  FaMoneyBillWave,
  FaCalculator,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPrint,
  FaLock,
  FaUnlock,
} from 'react-icons/fa';

export default function CashierShiftManager({ activeShift, onOpenShift, onCloseShift }) {
  const [openingFloat, setOpeningFloat] = useState(5000);
  const [openNotes, setOpenNotes] = useState('Front desk morning float in KES');

  // Close shift state
  const [actualCashCount, setActualCashCount] = useState(5000);
  const [closeNotes, setCloseNotes] = useState('Shift closed and drawer counted.');
  const [closedSummary, setClosedSummary] = useState(null);

  const handleStartShift = (e) => {
    e.preventDefault();
    if (Number(openingFloat) < 0) {
      alert('Opening float cannot be negative.');
      return;
    }

    const shift = {
      id: `shift-${Date.now()}`,
      cashierName: JSON.parse(sessionStorage.getItem('rms_admin_user') || '{}')?.firstName || 'Cashier',
      openTime: new Date().toISOString(),
      openingBalance: Number(openingFloat),
      status: 'open',
      notes: openNotes,
    };

    onOpenShift(shift);
  };

  const handleEndShift = (e) => {
    e.preventDefault();
    if (!activeShift) return;

    const actual = Number(actualCashCount);
    const expected = Number(activeShift.openingBalance || 5000) + (activeShift.cashSales || 0);
    const discrepancy = actual - expected;

    const summary = {
      shiftId: activeShift.id,
      cashierName: activeShift.cashierName || 'Cashier',
      openTime: activeShift.openTime,
      closeTime: new Date().toISOString(),
      openingBalance: activeShift.openingBalance || 5000,
      cashSales: activeShift.cashSales || 0,
      expectedBalance: expected,
      actualBalance: actual,
      discrepancy,
      status: discrepancy === 0 ? 'BALANCED' : discrepancy > 0 ? 'OVERAGE' : 'SHORTAGE',
      notes: closeNotes,
    };

    setClosedSummary(summary);
    onCloseShift(summary);
  };

  if (closedSummary) {
    return (
      <div className="shift-page shift-closed-page">
        <div className="shift-closed-header">
          <div className="shift-success-icon">
            <FaCheckCircle />
          </div>
          <h2>Shift Closed &amp; Reconciled!</h2>
          <p>Official cash drawer end-of-shift handover report.</p>
        </div>

        <div className="shift-receipt">
          <div className="shift-receipt-header">
            <h3>CASHIER SHIFT RECONCILIATION</h3>
            <p>{new Date(closedSummary.closeTime).toLocaleString()}</p>
          </div>

          <div className="shift-receipt-section">
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="font-bold">{closedSummary.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span>Opened At:</span>
              <span>{new Date(closedSummary.openTime).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Closed At:</span>
              <span>{new Date(closedSummary.closeTime).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="shift-receipt-section shift-receipt-totals">
            <div className="flex justify-between">
              <span>Opening Float:</span>
              <span>KES {closedSummary.openingBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash Sales Collected:</span>
              <span>KES {closedSummary.cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-neutral-900 border-t border-neutral-200 pt-1">
              <span>Expected Drawer Total:</span>
              <span>KES {closedSummary.expectedBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-neutral-900">
              <span>Actual Counted Cash:</span>
              <span>KES {closedSummary.actualBalance.toLocaleString()}</span>
            </div>
            <div className={`shift-variance ${
              closedSummary.discrepancy === 0 ? 'text-emerald-700' : closedSummary.discrepancy > 0 ? 'text-amber-700' : 'text-rose-700'
            }`}>
              <span>Variance:</span>
              <span>{closedSummary.discrepancy >= 0 ? '+' : ''}KES {closedSummary.discrepancy.toLocaleString()} ({closedSummary.status})</span>
            </div>
          </div>
        </div>

        <div className="shift-actions">
          <button
            onClick={() => window.print()}
            className="shift-button dark"
          >
            <FaPrint /> Print Shift Report
          </button>
          <button
            onClick={() => setClosedSummary(null)}
            className="shift-button amber"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shift-page">
      <div className="shift-page-header">
        <h2>
          <FaClock /> Cashier Shift &amp; Cash Drawer Control (KES)
        </h2>
        <p>
          Manage starting floats, monitor active cash drawer totals, and reconcile end-of-shift variances.
        </p>
      </div>

      {activeShift ? (
        /* Active Shift Panel: Live Details & Close Shift Form */
        <div className="shift-active-layout">
          <div className="shift-active-card">
            <div className="shift-card-header">
              <div className="shift-card-heading">
                <span className="shift-live-dot"></span>
                <h3>Active Cashier Shift Session</h3>
              </div>
              <span className="shift-open-badge">
                OPEN &amp; ACTIVE
              </span>
            </div>

            <div className="shift-metrics">
              <div className="shift-metric">
                <span>Session Started</span>
                <strong>
                  {new Date(activeShift.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>

              <div className="shift-metric">
                <span>Starting Float (KES)</span>
                <strong>
                  KES {Number(activeShift.openingBalance || 5000).toLocaleString()}
                </strong>
              </div>

              <div className="shift-metric">
                <span>Expected Drawer Balance</span>
                <strong className="amber-text">
                  KES {Number(activeShift.openingBalance || 5000).toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          {/* Close Shift Drawer Count Form */}
          <form onSubmit={handleEndShift} className="shift-form close-form">
            <h3>
              <FaLock /> End-of-Shift Cash Reconciliation
            </h3>

            <div className="shift-form-fields">
              <div>
                <label>
                  Actual Physical Cash Counted in Drawer (KES) *
                </label>
                <input
                  type="number"
                  required
                  value={actualCashCount}
                  onChange={(e) => setActualCashCount(e.target.value)}
                  className="shift-input amount"
                />
              </div>

              <div>
                <label>
                  Handover Notes &amp; Comments
                </label>
                <textarea
                  rows="2"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="shift-input"
                />
              </div>
            </div>

            <div className="shift-form-actions">
              <button
                type="submit"
                className="shift-button danger"
              >
                <FaLock /> Reconcile &amp; Close Shift
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Start New Shift Form */
        <form onSubmit={handleStartShift} className="shift-form open-form">
          <div className="shift-form-header">
            <div className="shift-open-icon">
              <FaUnlock />
            </div>
            <h3>Start Cashier Shift</h3>
            <p>Enter your opening cash drawer float to start taking walk-in bookings.</p>
          </div>

          <div className="shift-form-fields">
            <div>
              <label>
                Opening Float Cash Amount (KES) *
              </label>
              <input
                type="number"
                required
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="shift-input amount"
              />
              <div className="float-presets">
                {[3000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningFloat(amt)}
                    className="float-preset"
                  >
                    KES {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label>
                Starting Shift Notes
              </label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                className="shift-input"
              />
            </div>
          </div>

          <button
            type="submit"
            className="shift-button amber full"
          >
            <FaUnlock /> Start &amp; Open Shift (KES)
          </button>
        </form>
      )}
    </div>
  );
}

