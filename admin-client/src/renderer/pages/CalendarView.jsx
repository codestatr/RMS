import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FaCalendarCheck,
} from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [units, setUnits] = useState([]);
  const monthDate = new Date(`${currentMonth}-01T00:00:00`);
  const daysInMonth = Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  useEffect(() => {
    const headers = { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` };
    const loadBookings = async () => {
      const result = [];
      let page = 1;
      let pages = 1;
      do {
        const response = await axios.get(`${API_URL}/bookings`, { headers, params: { limit: 100, page } });
        const payload = response.data?.data || {};
        result.push(...(payload.data || []));
        pages = payload.pagination?.pages || 1;
        page += 1;
      } while (page <= pages);
      return result;
    };
    Promise.all([
      axios.get(`${API_URL}/properties?limit=500`),
      loadBookings(),
    ]).then(([propertyResponse, bookings]) => {
      const properties = propertyResponse.data?.data?.data || propertyResponse.data?.data || [];
      const monthYear = monthDate.getFullYear();
      const monthIndex = monthDate.getMonth();
      const lastDay = new Date(monthYear, monthIndex + 1, 0).getDate();
      const nextMonth = new Date(monthYear, monthIndex + 1, 1);
      const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const monthStart = `${currentMonth}-01`;
      setUnits(properties.map((property) => ({
        id: property.id,
        name: property.name,
        type: String(property.type || 'Rental Unit').replaceAll('_', ' '),
          bookings: bookings
          .filter((booking) => {
            if (String(booking.propertyId || booking.property_id) !== String(property.id) || !['confirmed', 'checked_in'].includes(booking.status)) return false;
            const checkIn = String(booking.checkInDate || booking.check_in_date).slice(0, 10);
            const checkOut = String(booking.checkOutDate || booking.check_out_date).slice(0, 10);
            return checkIn < nextMonthStart && checkOut > monthStart;
          })
          .map((booking) => {
            const startDate = String(booking.checkInDate || booking.check_in_date).slice(0, 10);
            const endDate = String(booking.checkOutDate || booking.check_out_date).slice(0, 10);
            return {
              start: startDate > monthStart ? Number(startDate.slice(-2)) : 1,
              end: endDate <= `${currentMonth}-${String(lastDay).padStart(2, '0')}` ? Number(endDate.slice(-2)) - 1 : lastDay,
              guest: booking.customerName || booking.customer_name || 'Reserved',
              status: booking.status,
            };
          }),
        maintenance: property.status === 'maintenance' || property.housekeeping_status === 'maintenance',
      })));
    }).catch(() => setUnits([]));
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
            Visual room occupancy timeline across all accommodations for {monthLabel}.
          </p>
        </div>

        <label className="calendar-month-control">Calendar month
          <input type="month" value={currentMonth} onChange={(event) => setCurrentMonth(event.target.value)} />
        </label>

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
              <div key={d} className={`calendar-day-number ${monthDate.getFullYear() === new Date().getFullYear() && monthDate.getMonth() === new Date().getMonth() && d === new Date().getDate() ? 'today' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Unit Rows */}
          <div className="calendar-rows">
            {units.length === 0 && <p className="calendar-empty">No property or booking data is available for this calendar.</p>}
            {units.map((unit) => (
              <div key={unit.id} className="calendar-row">
                <div className="calendar-unit" title={unit.name}>
                  {unit.name}
                  <span>{unit.type}</span>
                </div>

                {daysInMonth.map((d) => {
                  const booking = getDayStatus(unit.bookings, d);
                  const maintenance = !booking && unit.maintenance;
                  const isStart = booking && booking.start === d;

                  return (
                    <div
                      key={d}
                      className={`calendar-cell ${
                        booking || maintenance
                          ? maintenance ? 'maintenance' : 'booked'
                          : 'available'
                      }`}
                      title={booking ? `${booking.guest} (${unit.name})` : maintenance ? `${unit.name}: Maintenance` : `Day ${d}: Available`}
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

