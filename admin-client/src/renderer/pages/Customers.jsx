import React, { useState, useEffect } from 'react';
import { FaUserFriends, FaBan, FaCheck, FaSearch } from 'react-icons/fa';
import axios from 'axios';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerActivity, setCustomerActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      const all = res.data?.data?.data || [];
      setCustomers(all.filter((u) => u.role === 'customer'));
    } catch (e) {
      // Local demo fallback
      setCustomers([
        { id: 'c1', firstName: 'David', lastName: 'Kamau', email: 'customer@rms.com', phone: '+254744000444', status: 'active', city: 'Nairobi', createdAt: '2026-08-15' },
        { id: 'c2', firstName: 'John', lastName: 'Doe', email: 'john.doe@gmail.com', phone: '+254755000555', status: 'active', city: 'Mombasa', createdAt: '2026-08-20' },
        { id: 'c3', firstName: 'Sarah', lastName: 'Njeri', email: 'sarah.n@yahoo.com', phone: '+254766000666', status: 'active', city: 'Kisumu', createdAt: '2026-08-25' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlacklist = (customer) => {
    const newStatus = customer.status === 'suspended' ? 'active' : 'suspended';
    setCustomers(
      customers.map((c) => (c.id === customer.id ? { ...c, status: newStatus } : c))
    );
  };

  const handleViewHistory = async (customer) => {
    setSelectedCustomer(customer);
    setActivityLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/customer-activity/${customer.id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
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
                  <button
                    onClick={() => handleViewHistory(c)}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-sky-300 text-sky-700 hover:bg-sky-50 transition"
                  >
                    Guest History
                  </button>
                  <button
                    onClick={() => handleToggleBlacklist(c)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                      c.status === 'suspended'
                        ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    {c.status === 'suspended' ? 'Lift Ban' : 'Flag / Blacklist'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
          <div className="admin-card w-full max-w-lg space-y-5 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-neutral-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
                <p className="text-xs text-neutral-500">Guest history and account activity</p>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerActivity(null); }} className="text-xs font-bold text-neutral-500">Close</button>
            </div>
            {activityLoading ? <p className="text-sm text-neutral-500">Loading guest history...</p> : customerActivity ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span className="text-xs text-neutral-500">Total Stays</span><strong className="mt-1 block text-xl">{customerActivity.totalBookings}</strong></div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span className="text-xs text-neutral-500">Total Spent</span><strong className="mt-1 block text-xl text-amber-700">KES {Number(customerActivity.totalSpent || 0).toLocaleString()}</strong></div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span className="text-xs text-neutral-500">Reviews Given</span><strong className="mt-1 block text-xl">{customerActivity.reviewsGiven}</strong></div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><span className="text-xs text-neutral-500">Average Rating</span><strong className="mt-1 block text-xl text-sky-700">{customerActivity.averageRating || '0.0'}</strong></div>
              </div>
            ) : <p className="text-sm text-rose-600">Guest history is unavailable.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
