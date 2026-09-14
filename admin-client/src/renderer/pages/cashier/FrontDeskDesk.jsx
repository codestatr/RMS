import React, { useState, useEffect } from 'react';
import {
  FaUserCheck,
  FaSearch,
  FaCalendarAlt,
  FaKey,
  FaSignOutAlt,
  FaCheck,
  FaTimes,
  FaReceipt,
} from 'react-icons/fa';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const resolveGuestName = (booking = {}) => {
  const candidate =
    booking.guestName ||
    booking.customerName ||
    booking.customer_name ||
    booking.guest_name ||
    [booking.first_name || booking.firstName, booking.last_name || booking.lastName].filter(Boolean).join(' ') ||
    [booking.firstName, booking.lastName].filter(Boolean).join(' ') ||
    'Guest';

  return String(candidate || 'Guest').trim() || 'Guest';
};

export default function FrontDeskDesk() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      setBookings(res.data?.data?.data || res.data?.data || []);
    } catch {
      // Fallback demo bookings in KES
      setBookings([
        { id: 'book-201', guestName: 'David Kamau', phone: '+254744000444', propertyName: 'Sunlight Luxury 1-Bedroom Apartment', checkInDate: '2026-09-05', checkOutDate: '2026-09-08', totalAmount: 16500, status: 'confirmed' },
        { id: 'book-202', guestName: 'John Doe', phone: '+254755000555', propertyName: 'Ocean Breeze Beachfront Airbnb Villa', checkInDate: '2026-09-10', checkOutDate: '2026-09-15', totalAmount: 90000, status: 'checked_in' },
        { id: 'book-203', guestName: 'Sarah Njeri', phone: '+254766000666', propertyName: 'Cozy Urban Bedsitter Studio', checkInDate: '2026-09-20', checkOutDate: '2026-09-22', totalAmount: 5000, status: 'pending' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      await axios.patch(
        `${API_URL}/bookings/${bookingId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` } }
      );
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      alert(`Booking #${bookingId.slice(0, 8)} status updated to ${newStatus.replace('_', ' ').toUpperCase()}!`);
    } catch (err) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      alert(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()} (Local mode)`);
    }
  };

  const filtered = bookings.filter((b) => {
    const term = search.toLowerCase();
    return (
      resolveGuestName(b).toLowerCase().includes(term) ||
      (b.phone || b.customer_phone || '').includes(term) ||
      (b.propertyName || b.property_name || '').toLowerCase().includes(term) ||
      (b.id || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
            <FaKey className="text-amber-500" /> Front-Desk Check-In & Check-Out Terminal
          </h2>
          <p className="text-xs text-neutral-500">
            Verify guest arrivals, assign keys, collect balances, and manage departure handovers.
          </p>
        </div>

        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            placeholder="Search guest, phone, or unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none"
          />
          <FaSearch className="absolute left-3 top-2.5 text-neutral-400 text-xs" />
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Guest Name</th>
              <th>Contact Phone</th>
              <th>Unit / Property</th>
              <th>Dates</th>
              <th>Total Bill (KES)</th>
              <th>Status</th>
              <th>Front-Desk Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-neutral-400 italic">
                  No reservations match your search.
                </td>
              </tr>
            ) : (
              filtered.map((b) => {
                const name = resolveGuestName(b);
                const phone = b.phone || b.customer_phone || '—';
                const prop = b.propertyName || b.property_name || 'Rental Unit';
                const total = Number(b.totalAmount || b.total_amount || 0);

                return (
                  <tr key={b.id}>
                    <td className="font-bold text-neutral-900">{name}</td>
                    <td className="font-mono text-neutral-600">{phone}</td>
                    <td className="font-semibold text-neutral-800">{prop}</td>
                    <td className="text-[11px] text-neutral-500">
                      {b.checkInDate || b.check_in_date} &rarr; {b.checkOutDate || b.check_out_date}
                    </td>
                    <td className="font-black text-amber-700">KES {total.toLocaleString()}</td>
                    <td>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'checked_in'
                            ? 'bg-sky-100 text-sky-800'
                            : b.status === 'checked_out'
                            ? 'bg-neutral-200 text-neutral-700'
                            : b.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {['pending', 'confirmed'].includes(b.status) && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'checked_in')}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition"
                          >
                            <FaKey size={10} /> Check In
                          </button>
                        )}

                        {b.status === 'checked_in' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'checked_out')}
                            className="bg-neutral-800 hover:bg-neutral-900 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition"
                          >
                            <FaSignOutAlt size={10} /> Check Out
                          </button>
                        )}

                        {b.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

