import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FaCalendarCheck,
  FaChevronLeft,
  FaChevronRight,
  FaBed,
  FaInfoCircle,
} from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState('September 2026');
  const [liveUnits, setLiveUnits] = useState(null);

  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  const fallbackUnits = [
    {
      id: 'prop-101',
      name: 'Sunlight Luxury 1-Bedroom',
      type: 'One Bedroom',
      bookings: [
        { start: 5, end: 8, guest: 'David Kamau', status: 'confirmed' },
        { start: 14, end: 18, guest: 'Mercy W.', status: 'confirmed' },
        { start: 22, end: 26, guest: 'Alex M.', status: 'confirmed' },
      ],
    },
    {
      id: 'prop-102',
      name: 'Ocean Breeze Beachfront Villa',
      type: 'Airbnb Villa',
      bookings: [
        { start: 10, end: 15, guest: 'John Doe', status: 'checked_in' },
        { start: 20, end: 28, guest: 'Sarah Connor', status: 'confirmed' },
      ],
    },
    {
      id: 'prop-103',
      name: 'Cozy Urban Bedsitter Studio',
      type: 'Bedsitter',
      bookings: [
        { start: 1, end: 6, guest: 'Tom Hardy', status: 'checked_out' },
        { start: 20, end: 22, guest: 'Sarah Njeri', status: 'confirmed' },
      ],
    },
    {
      id: 'prop-104',
      name: 'Lakeview Executive BnB',
      type: 'BnB',
      bookings: [
        { start: 8, end: 12, guest: 'Grace K.', status: 'confirmed' },
        { start: 16, end: 20, guest: 'Peter Pan', status: 'confirmed' },
      ],
    },
    {
      id: 'prop-105',
      name: 'Downtown Single Room Suite',
      type: 'Single Room',
      bookings: [
        { start: 2, end: 5, guest: 'Maintenance', status: 'maintenance' },
        { start: 12, end: 15, guest: 'Kevin O.', status: 'confirmed' },
      ],
    },
  ];

  const units = liveUnits || fallbackUnits;

  useEffect(() => {
    const headers = { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` };
    Promise.all([
      axios.get(`${API_URL}/properties?limit=100`),
      axios.get(`${API_URL}/bookings?limit=100`, { headers }),
    ]).then(([propertyResponse, bookingResponse]) => {
      const properties = propertyResponse.data?.data?.data || propertyResponse.data?.data || [];
      const bookings = bookingResponse.data?.data?.data || bookingResponse.data?.data || [];
      if (!properties.length) return;

      const monthStart = new Date(`${currentMonth} 1`);
      const monthYear = monthStart.getFullYear();
      const monthIndex = monthStart.getMonth();
      setLiveUnits(properties.map((property) => ({
        id: property.id,
        name: property.name,
        type: String(property.type || 'Rental Unit').replaceAll('_', ' '),
        bookings: bookings
          .filter((booking) => booking.propertyId === property.id && !['cancelled', 'checked_out'].includes(booking.status))
          .map((booking) => {
            const startDate = new Date(booking.checkInDate);
            const endDate = new Date(booking.checkOutDate);
            return {
              start: startDate.getFullYear() === monthYear && startDate.getMonth() === monthIndex ? startDate.getDate() : 1,
              end: endDate.getFullYear() === monthYear && endDate.getMonth() === monthIndex ? endDate.getDate() : 30,
              guest: booking.customerName || 'Reserved',
              status: booking.status,
            };
          }),
      })));
    }).catch(() => {
      // Keep the demo matrix available while offline.
    });
  }, [currentMonth]);

  const getDayStatus = (unitBookings, day) => {
    for (const b of unitBookings) {
      if (day >= b.start && day <= b.end) {
        return b;
      }
    }
    return null;
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <h2 className="calendar-title">
            <FaCalendarCheck /> Availability Matrix &amp; Stays Schedule
          </h2>
          <p className="calendar-subtitle">
            Visual room occupancy timeline across all accommodations for {currentMonth}.
          </p>
        </div>

        <div className="calendar-legend">
          <div className="calendar-legend-item">
            <span className="calendar-swatch confirmed"></span>
            <span>Confirmed / Checked-In</span>
          </div>
          <div className="calendar-legend-item">
            <span className="calendar-swatch maintenance"></span>
            <span>Maintenance</span>
          </div>
          <div className="calendar-legend-item">
            <span className="calendar-swatch available"></span>
            <span>Available</span>
          </div>
        </div>
      </div>

      {/* Calendar Matrix Grid */}
      <div className="calendar-card">
        <div className="calendar-scroll">
          {/* Days Header */}
          <div className="calendar-days-header">
            <div className="calendar-unit-heading">Rental Accommodation</div>
            {daysInMonth.map((d) => (
              <div key={d} className={`calendar-day-number ${d === 8 ? 'today' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Unit Rows */}
          <div className="calendar-rows">
            {units.map((unit) => (
              <div key={unit.id} className="calendar-row">
                <div className="calendar-unit" title={unit.name}>
                  {unit.name}
                  <span>{unit.type}</span>
                </div>

                {daysInMonth.map((d) => {
                  const booking = getDayStatus(unit.bookings, d);
                  const isStart = booking && booking.start === d;

                  return (
                    <div
                      key={d}
                      className={`calendar-cell ${
                        booking
                          ? booking.status === 'maintenance'
                            ? 'maintenance'
                            : 'booked'
                          : 'available'
                      }`}
                      title={booking ? `${booking.guest} (${unit.name})` : `Day ${d}: Available`}
                    >
                      {isStart ? booking.guest.split(' ')[0] : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

