import React, { useState, useEffect } from 'react';
import {
  FaUserCheck,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaReceipt,
  FaBed,
  FaMapMarkerAlt,
  FaPhone,
  FaUser,
  FaIdCard,
} from 'react-icons/fa';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function CashierWalkIn({ activeShift, onProceedToPayment, allowWithoutShift = false }) {
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);

  const cashierUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('rms_admin_user') || '{}');
    } catch {
      return {};
    }
  })();
  const cashierDisplayName = [cashierUser.firstName, cashierUser.lastName].filter(Boolean).join(' ') || 'Cashier';
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow.toISOString().split('T')[0]);

  // Guest details
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestIdNumber, setGuestIdNumber] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [autoCheckIn, setAutoCheckIn] = useState(true);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const res = await axios.get(`${API_URL}/properties?status=available`);
      const list = res.data?.data?.data || res.data?.data || [];
      setProperties(list);
      if (list.length > 0) setSelectedPropertyId(list[0].id);
    } catch {
      // Fallback demo properties in KES
      const fallbackList = [
        { id: 'prop-101', name: 'Sunlight Luxury 1-Bedroom Apartment', type: 'one_bedroom', price_per_night: 5500, address: 'Woodvale Grove, Westlands', capacity: 2 },
        { id: 'prop-102', name: 'Ocean Breeze Beachfront Airbnb Villa', type: 'airbnb', price_per_night: 18000, address: 'Diani Beach Road', capacity: 6 },
        { id: 'prop-103', name: 'Cozy Urban Bedsitter Studio', type: 'bedsitter', price_per_night: 2500, address: 'Ngong Road, Kilimani', capacity: 1 },
        { id: 'prop-104', name: 'Lakeview Executive Bed & Breakfast', type: 'bnb', price_per_night: 6500, address: 'Riat Hills, Kisumu', capacity: 3 },
        { id: 'prop-105', name: 'Downtown Executive Single Room Suite', type: 'single_room', price_per_night: 3500, address: 'Kenyatta Avenue, CBD', capacity: 1 },
      ];
      setProperties(fallbackList);
      setSelectedPropertyId(fallbackList[0].id);
    }
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) || properties[0];

  const nights = Math.max(
    1,
    Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))
  );

  const pricePerNight = Number(selectedProperty?.price_per_night || selectedProperty?.pricePerNight || 5500);
  const subtotal = pricePerNight * nights;
  const vatTax = Math.round(subtotal * 0.16);
  const totalBeforeDiscount = subtotal + vatTax;
  const appliedDiscount = Math.min(Math.max(0, Number(discountAmount) || 0), totalBeforeDiscount);
  const totalAmount = totalBeforeDiscount - appliedDiscount;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeShift && !allowWithoutShift) {
      alert('Please open your Cashier Shift before taking walk-in bookings.');
      return;
    }

    if (!guestName.trim() || !guestPhone.trim()) {
      alert('Please enter guest name and phone number.');
      return;
    }

    onProceedToPayment({
      property: selectedProperty,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestIdNumber: guestIdNumber.trim(),
      checkInDate,
      checkOutDate,
      nights,
      guestCount,
      subtotal,
      vatTax,
      totalBeforeDiscount,
      totalAmount,
      discountAmount: appliedDiscount,
      specialRequests,
      autoCheckIn,
    });
  };

  return (
    <div className="pos-workflow">
      <div className="pos-workflow-header">
        <div>
          <h2>
            <FaBed className="text-amber-500" /> Walk-In Guest Reservation & POS Check-In
          </h2>
          <p>
            Quickly register on-site guests, calculate stay charges in Kenyan Shillings (KES), and collect payment.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2 shadow-sm">
          <span className="text-xl font-extrabold text-neutral-900 tracking-tight">{cashierDisplayName}</span>
          <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]" />
        </div>

        {activeShift ? (
          <div className="shift-status active">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Shift Active (Float: KES {Number(activeShift.openingBalance || activeShift.opening_balance || 5000).toLocaleString()})
          </div>
        ) : (
          <div className="shift-status inactive">
            ⚠️ No Active Shift (Start Shift to take payments)
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="pos-form-grid">
        {/* Left 2 Columns: Room Selection & Guest Information */}
        <div className="pos-form-main">
          {/* 1. Property Unit Selection */}
          <div className="pos-section-card">
            <h3 className="pos-section-title">
              <span className="pos-step">1</span>
              Select Rental Property / Unit
            </h3>

            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Available Rental Units</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type?.replace('_', ' ')}) — KES {Number(p.price_per_night || p.pricePerNight || 5500).toLocaleString()}/night
                  </option>
                ))}
              </select>
            </div>

            {selectedProperty && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-neutral-900 block">{selectedProperty.name}</span>
                  <span className="text-neutral-500 flex items-center gap-1 mt-0.5">
                    <FaMapMarkerAlt className="text-amber-500" /> {selectedProperty.address || selectedProperty.city}
                  </span>
                </div>
                <span className="font-black text-amber-700 text-sm">
                  KES {pricePerNight.toLocaleString()} <span className="text-[10px] font-normal text-neutral-500">/ night</span>
                </span>
              </div>
            )}
          </div>

          {/* 2. Stay Dates & Guest Count */}
          <div className="pos-section-card">
            <h3 className="pos-section-title">
              <span className="pos-step">2</span>
              Stay Duration & Occupancy
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Check-In Date</label>
                <input
                  type="date"
                  required
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Check-Out Date</label>
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Number of Guests</label>
                <select
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-semibold"
                >
                  <option value="1">1 Guest</option>
                  <option value="2">2 Guests</option>
                  <option value="3">3 Guests</option>
                  <option value="4">4 Guests</option>
                  <option value="5">5+ Guests</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Guest Profile & Identification */}
          <div className="pos-section-card">
            <h3 className="pos-section-title">
              <span className="pos-step">3</span>
              Guest Profile Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Guest Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Kamau"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Mobile Phone (M-Pesa / SMS) *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0712345678"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">National ID / Passport No.</label>
                <input
                  type="text"
                  placeholder="e.g. ID-32910291"
                  value={guestIdNumber}
                  onChange={(e) => setGuestIdNumber(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Special Notes / Requests</label>
                <input
                  type="text"
                  placeholder="e.g. Extra key requested"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Discount (KES)</label>
                <input
                  type="number"
                  min="0"
                  max={totalBeforeDiscount}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-bold"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCheckIn}
                  onChange={(e) => setAutoCheckIn(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-neutral-300"
                />
                <span>Automatically mark as <strong>Checked In</strong> upon payment completion</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Live Bill Summary in KES & Checkout CTA */}
        <div className="pos-form-summary-column">
          <div className="pos-bill-card">
            <h3 className="pos-bill-title">
              <FaReceipt className="text-amber-500" /> POS Bill Summary (KES)
            </h3>

            <div className="pos-bill-lines">
              <div className="flex justify-between">
                <span>Selected Unit:</span>
                <span className="font-bold text-neutral-900 line-clamp-1">{selectedProperty?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-bold text-neutral-900">{nights} Night(s)</span>
              </div>
              <div className="flex justify-between">
                <span>Rate per Night:</span>
                <span className="font-semibold text-neutral-800">KES {pricePerNight.toLocaleString()}</span>
              </div>
            </div>

            <div className="pos-bill-totals">
              <div className="flex justify-between">
                <span>Subtotal (Net):</span>
                <span>KES {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>16% VAT Tax:</span>
                <span>KES {vatTax.toLocaleString()}</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>- KES {appliedDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-extrabold text-neutral-900">
                <span>TOTAL DUE:</span>
                <span className="text-amber-600 text-base font-black">KES {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!activeShift && !allowWithoutShift}
              className={`pos-submit-button ${
                activeShift || allowWithoutShift
                  ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                  : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <FaMoneyBillWave /> Proceed to Payment &rarr;
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

