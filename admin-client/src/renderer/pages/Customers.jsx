import React, { useState, useEffect } from 'react';
import { FaUserFriends, FaBan, FaCheck, FaSearch, FaTimes } from 'react-icons/fa';
import axios from 'axios';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerActivity, setCustomerActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [updatingCustomerIds, setUpdatingCustomerIds] = useState([]);
  const [customerError, setCustomerError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setCustomerError('');
    try {
      const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || '';
      const users = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await axios.get(`${API_URL}/users`, {
          params: { role: 'customer', page, limit: 100 },
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = res.data?.data;
        users.push(...(Array.isArray(result?.data) ? result.data : []));
        totalPages = Math.max(1, Number(result?.pagination?.pages) || 1);
        page += 1;
      } while (page <= totalPages);
      setCustomers(users);
    } catch (error) {
      setCustomers([]);
      setCustomerError(error.response?.data?.message || error.response?.data?.error || 'Unable to load customer accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlacklist = async (customer) => {
    const isBlacklisted = customer.status === 'suspended';
    const action = isBlacklisted ? 'reactivate' : 'suspend';
    const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || '';
    setUpdatingCustomerIds((ids) => [...ids, customer.id]);
    setCustomerError('');
    try {
      await axios.post(`${API_URL}/users/${customer.id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers((items) => items.map((item) => (
        item.id === customer.id ? { ...item, status: isBlacklisted ? 'active' : 'suspended' } : item
      )));
    } catch (error) {
      setCustomerError(error.response?.data?.message || error.response?.data?.error || 'Unable to update this customer account.');
    } finally {
      setUpdatingCustomerIds((ids) => ids.filter((id) => id !== customer.id));
    }
  };

  const handleViewHistory = async (customer) => {
    setSelectedCustomer(customer);
    setActivityLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/customer-activity/${customer.id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}` },
      });
      setCustomerActivity(res.data?.data || null);
    } catch {
      setCustomerActivity(null);
    } finally {
      setActivityLoading(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900">Customer Directory & Guest Verification</h2>
          <p className="text-xs text-neutral-500">Manage registered guests, verify contact info, and manage blacklist flags.</p>
        </div>

        <div className="w-64">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs"
          />
        </div>
      </div>

      <div className="admin-card">
        {customerError && <div className="login-error" role="alert">{customerError}</div>}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Member Since</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="font-bold text-neutral-900">
                  {c.firstName} {c.lastName}
                </td>
                <td>{c.email}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.city || 'Kenya'}</td>
                <td>{new Date(c.createdAt || Date.now()).toLocaleDateString()}</td>
                <td>
                  <span className={c.status === 'active' ? 'badge-confirmed' : 'badge-suspended'}>
                    {c.status === 'suspended' ? 'Blacklisted' : 'Active'}
                  </span>
                </td>
                <td>
                  <div className="customer-action-group">
                  <button
                    type="button"
                    onClick={() => handleViewHistory(c)}
                    className="customer-action-button history"
                  >
                    <FaUserFriends aria-hidden="true" />
                    Guest History
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleBlacklist(c)}
                    disabled={updatingCustomerIds.includes(c.id)}
                    className={`customer-action-button ${
                      c.status === 'suspended'
                        ? 'restore'
                        : 'flag'
                    }`}
                  >
                    {updatingCustomerIds.includes(c.id) ? 'Saving…' : <>
                      {c.status === 'suspended' ? <FaCheck aria-hidden="true" /> : <FaBan aria-hidden="true" />}
                      {c.status === 'suspended' ? 'Lift Ban' : 'Flag / Blacklist'}
                    </>}
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCustomer && (
        <div className="customer-history-overlay">
          <section className="customer-history-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-history-title">
            <div className="customer-history-header">
              <div>
                <span className="customer-history-eyebrow">Guest account</span>
                <h3 id="customer-history-title">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
                <p>Guest history and account activity</p>
              </div>
              <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerActivity(null); }} className="customer-history-close" aria-label="Close guest history"><FaTimes /></button>
            </div>
            {activityLoading ? <p className="customer-history-message">Loading guest history...</p> : customerActivity ? (
              <div className="customer-history-metrics">
                <div className="customer-history-metric"><span>Total stays</span><strong>{customerActivity.totalBookings}</strong></div>
                <div className="customer-history-metric"><span>Total spent</span><strong className="is-accent">KES {Number(customerActivity.totalSpent || 0).toLocaleString()}</strong></div>
                <div className="customer-history-metric"><span>Reviews given</span><strong>{customerActivity.reviewsGiven}</strong></div>
                <div className="customer-history-metric"><span>Average rating</span><strong className="is-rating">{customerActivity.averageRating || '0.0'}</strong></div>
              </div>
            ) : <p className="customer-history-message is-error">Guest history is unavailable.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
