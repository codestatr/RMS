import React, { useState } from 'react';
import { useEffect } from 'react';
import {
  FaBroom,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTools,
  FaBed,
  FaUserCheck,
} from 'react-icons/fa';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const fallbackUnits = [
  { id: 'prop-101', name: 'Sunlight Luxury 1-Bedroom Apartment', type: 'One Bedroom', status: 'clean', lastCleaned: '2026-09-08 09:30 AM', housekeeper: 'Mercy A.', notes: 'Fresh linens and toiletries stocked' },
  { id: 'prop-102', name: 'Ocean Breeze Beachfront Airbnb Villa', type: 'Airbnb Villa', status: 'occupied', lastCleaned: '2026-09-07 02:00 PM', housekeeper: 'Brian O.', notes: 'Guest in residence until Sept 15' },
  { id: 'prop-103', name: 'Cozy Urban Bedsitter Studio', type: 'Bedsitter', status: 'dirty', lastCleaned: '2026-09-06 11:00 AM', housekeeper: 'Mercy A.', notes: 'Guest departed this morning. Needs full turnover' },
  { id: 'prop-104', name: 'Lakeview Executive Bed & Breakfast', type: 'BnB', status: 'clean', lastCleaned: '2026-09-08 08:00 AM', housekeeper: 'Grace K.', notes: 'Inspected and certified ready for check-in' },
  { id: 'prop-105', name: 'Downtown Executive Single Room Suite', type: 'Single Room', status: 'maintenance', lastCleaned: '2026-09-05 04:00 PM', housekeeper: 'Technical Staff', notes: 'Air conditioning unit servicing in progress' },
  { id: 'prop-106', name: 'Amber Heights 1-Bedroom Penthouse', type: 'One Bedroom', status: 'clean', lastCleaned: '2026-09-08 10:15 AM', housekeeper: 'Brian O.', notes: 'Jacuzzi sanitized & patio polished' },
];

export default function Maintenance() {
  const [units, setUnits] = useState(fallbackUnits);

  useEffect(() => {
    axios.get(`${API_URL}/properties?limit=100`).then((response) => {
      const properties = response.data?.data?.data || response.data?.data || [];
      if (properties.length > 0) {
        setUnits(properties.map((property) => ({
          id: property.id,
          name: property.name,
          type: String(property.type || 'Rental Unit').replaceAll('_', ' '),
          status: property.housekeepingStatus || (property.status === 'maintenance' ? 'maintenance' : 'clean'),
          lastCleaned: property.updatedAt ? new Date(property.updatedAt).toLocaleString() : 'Not recorded',
          housekeeper: 'Operations Team',
          notes: property.description || 'No housekeeping notes recorded',
        })));
      }
    }).catch(() => {
      // Keep the local board available when the backend is offline.
    });
  }, []);

  const handleUpdateStatus = (id, newStatus) => {
    const token = sessionStorage.getItem('rms_admin_token') || '';
    axios.patch(`${API_URL}/properties/${id}/housekeeping-status`, {
      housekeepingStatus: newStatus,
    }, { headers: { Authorization: `Bearer ${token}` } }).then(() => {
      setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, status: newStatus, lastCleaned: 'Just now' } : u)));
    }).catch(() => {
      window.alert('Unable to save housekeeping status. Please check the backend connection.');
    });
  };

  return (
    <div className="maintenance-page">
      <div className="maintenance-header">
        <div>
          <h2 className="maintenance-title">
            <FaBroom /> Housekeeping &amp; Unit Cleanliness Board
          </h2>
          <p className="maintenance-subtitle">
            Real-time room readiness status for front-desk cashiers and housekeeping teams.
          </p>
        </div>

        <div className="maintenance-summary">
          <span className="maintenance-badge clean">{units.filter((u) => u.status === 'clean').length} Clean &amp; Ready</span>
          <span className="maintenance-badge occupied">{units.filter((u) => u.status === 'occupied').length} Occupied</span>
          <span className="maintenance-badge dirty">{units.filter((u) => u.status === 'dirty').length} Needs Cleaning</span>
          <span className="maintenance-badge repair">{units.filter((u) => u.status === 'maintenance').length} Maintenance</span>
        </div>
      </div>

      <div className="maintenance-grid">
        {units.map((unit) => (
          <div
            key={unit.id}
            className={`maintenance-card ${unit.status}`}
          >
            <div>
              <div className="maintenance-card-top">
                <span className="maintenance-type">
                  {unit.type}
                </span>
                <span className="maintenance-status">
                  {unit.status === 'clean'
                    ? 'Clean & Ready'
                    : unit.status === 'occupied'
                    ? 'Occupied'
                    : unit.status === 'dirty'
                    ? 'Needs Cleaning'
                    : 'Maintenance'}
                </span>
              </div>

              <h3 className="maintenance-unit-name">{unit.name}</h3>
              <p className="maintenance-notes">{unit.notes}</p>
            </div>

            <div className="maintenance-card-footer">
              <div className="maintenance-meta">
                <span>Housekeeper: <strong>{unit.housekeeper}</strong></span>
                <span>{unit.lastCleaned}</span>
              </div>

              {/* Status Action Buttons */}
              <div className="maintenance-actions">
                <button
                  onClick={() => handleUpdateStatus(unit.id, 'clean')}
                  className={unit.status === 'clean' ? 'active clean' : 'clean'}
                >
                  Set Ready
                </button>

                <button
                  onClick={() => handleUpdateStatus(unit.id, 'dirty')}
                  className={unit.status === 'dirty' ? 'active dirty' : 'dirty'}
                >
                  Mark Dirty
                </button>

                <button
                  onClick={() => handleUpdateStatus(unit.id, 'maintenance')}
                  className={unit.status === 'maintenance' ? 'active repair' : 'repair'}
                >
                  Repair
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

