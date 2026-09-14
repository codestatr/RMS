import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FaBed,
  FaKey,
  FaClock,
  FaReceipt,
  FaExchangeAlt,
} from 'react-icons/fa';
import CashierWalkIn from './cashier/CashierWalkIn';
import CashierTender from './cashier/CashierTender';
import FrontDeskDesk from './cashier/FrontDeskDesk';
import CashierShiftManager from './cashier/CashierShiftManager';
import CashierTransactions from './cashier/CashierTransactions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function CashierTerminal({ activeShift, onOpenShift, onCloseShift, onSwitchToAdmin, onLogout, isAdmin, initialTab = 'walkin' }) {
  const [cashierTab, setCashierTab] = useState(initialTab); // 'walkin' | 'frontdesk' | 'shift' | 'transactions'
  const [tenderBookingData, setTenderBookingData] = useState(null);
  const [currentShift, setCurrentShift] = useState(activeShift || null);
  const cashierUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('rms_admin_user') || '{}');
    } catch {
      return {};
    }
  })();
  const cashierDisplayName = [cashierUser.firstName, cashierUser.lastName].filter(Boolean).join(' ') || 'Cashier';

  useEffect(() => {
    if (activeShift) {
      setCurrentShift(activeShift);
      return undefined;
    }

    let isMounted = true;
    axios.get(`${API_URL}/shifts/active`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
    }).then((response) => {
      if (isMounted) setCurrentShift(response.data?.data || null);
    }).catch(() => {
      if (isMounted) setCurrentShift(null);
    });

    return () => {
      isMounted = false;
    };
  }, [activeShift]);

  const handleOpenShift = async (shift) => {
    try {
      const response = await axios.post(`${API_URL}/shifts/open`, {
        openingBalance: shift.openingBalance,
        notes: shift.notes,
      }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      setCurrentShift(response.data?.data || shift);
    } catch {
      setCurrentShift(shift);
    }
    onOpenShift?.(shift);
  };

  const handleCloseShift = async (summary) => {
    if (currentShift?.id && !String(currentShift.id).startsWith('shift-')) {
      try {
        await axios.post(`${API_URL}/shifts/${currentShift.id}/close`, {
          actualClosingBalance: summary.actualBalance,
          notes: summary.notes,
        }, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
        });
      } catch {
        // Keep the local close flow available if the backend is offline.
      }
    }
    setCurrentShift(null);
    onCloseShift?.(summary);
    onLogout?.();
  };

  const handleProceedToPayment = (bookingData) => {
    setTenderBookingData(bookingData);
  };

  const handlePaymentComplete = () => {
    setTenderBookingData(null);
    setCashierTab('transactions');
  };

  return (
    <div className="pos-page">
      {/* Cashier Sub-navigation Bar */}
      <div className="pos-toolbar">
        <div className="pos-tabs">
          <button
            onClick={() => {
              setTenderBookingData(null);
              setCashierTab('walkin');
            }}
            className={`pos-tab ${
              cashierTab === 'walkin' && !tenderBookingData
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <FaBed /> Walk-In Booking
          </button>

          <button
            onClick={() => {
              setTenderBookingData(null);
              setCashierTab('frontdesk');
            }}
            className={`pos-tab ${
              cashierTab === 'frontdesk'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <FaKey /> Check-In / Out Desk
          </button>

          <button
            onClick={() => {
              setTenderBookingData(null);
              setCashierTab('shift');
            }}
            className={`pos-tab ${
              cashierTab === 'shift'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <FaClock /> Shift Management
          </button>

          <button
            onClick={() => {
              setTenderBookingData(null);
              setCashierTab('transactions');
            }}
            className={`pos-tab ${
              cashierTab === 'transactions'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <FaReceipt /> Shift Transactions
          </button>
        </div>

        <div className="pos-user-identity" title={`Logged in as ${cashierDisplayName}`}>
          <span className="pos-user-status" />
          <div className="pos-user-copy">
            <span className="pos-user-label">Logged in user</span>
            <strong>{cashierDisplayName}</strong>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={onSwitchToAdmin}
            className="pos-admin-switch"
          >
            <FaExchangeAlt /> Switch to Admin Portal
          </button>
        )}
      </div>

      {/* Main Cashier Content Routing */}
      <div>
        {tenderBookingData ? (
          <CashierTender
            bookingData={tenderBookingData}
            onBack={() => setTenderBookingData(null)}
            onComplete={handlePaymentComplete}
          />
        ) : cashierTab === 'walkin' ? (
          <CashierWalkIn
            activeShift={currentShift}
            allowWithoutShift={isAdmin}
            onProceedToPayment={handleProceedToPayment}
          />
        ) : cashierTab === 'frontdesk' ? (
          <FrontDeskDesk />
        ) : cashierTab === 'shift' ? (
          <CashierShiftManager
            activeShift={currentShift}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
          />
        ) : (
          <CashierTransactions />
        )}
      </div>
    </div>
  );
}

