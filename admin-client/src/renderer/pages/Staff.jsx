import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaUsers, FaUserCheck, FaUserTimes, FaKey } from 'react-icons/fa';
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [updatingStaffIds, setUpdatingStaffIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New staff form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('cashier');
  const [password, setPassword] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const resetStaffForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('cashier');
    setPassword('');
  };

  useEffect(() => {
    if (!isModalOpen) resetStaffForm();
  }, [isModalOpen]);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    setStaffError('');
    try {
      const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || '';
      const roles = ['admin', 'cashier', 'property_owner', 'housekeeping', 'catering'];
      const staffByRole = await Promise.all(roles.map(async (role) => {
        const users = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await axios.get(`${API_URL}/users`, {
            params: { role, page, limit: 100 },
            headers: { Authorization: `Bearer ${token}` },
          });
          const result = res.data?.data;
          users.push(...(Array.isArray(result?.data) ? result.data : []));
          totalPages = Math.max(1, Number(result?.pagination?.pages) || 1);
          page += 1;
        } while (page <= totalPages);
        return users;
      }));
      setStaffList(staffByRole.flat());
    } catch (e) {
      setStaffList([]);
      setStaffError(e.response?.data?.message || e.response?.data?.error || 'Unable to load staff accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    const hasLowercase = [...password].some((character) => character >= 'a' && character <= 'z');
    const hasUppercase = [...password].some((character) => character >= 'A' && character <= 'Z');
    const hasNumber = [...password].some((character) => character >= '0' && character <= '9');
    const hasSpecialCharacter = [...password].some((character) => '@$!%*?&'.includes(character));
    if (password.length < 8 || !hasLowercase || !hasUppercase || !hasNumber || !hasSpecialCharacter) {
      alert('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    try {
      await axios.post(`${API_URL}/users`, {
        firstName,
        lastName,
        email,
        phone,
        role,
        password,
      }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}` },
      });
      alert('Staff account created successfully!');
      setIsModalOpen(false);
      resetStaffForm();
      await loadStaff();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create staff account');
    }
  };

  const handleToggleStatus = async (member) => {
    const isActive = member.status === 'active';
    const action = isActive ? 'deactivate' : 'reactivate';
    const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || '';
    setUpdatingStaffIds((ids) => [...ids, member.id]);
    setStaffError('');
    try {
      await axios.post(`${API_URL}/users/${member.id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStaffList((members) => members.map((s) => (
        s.id === member.id ? { ...s, status: isActive ? 'inactive' : 'active' } : s
      )));
    } catch (error) {
      setStaffError(error.response?.data?.message || error.response?.data?.error || 'Unable to update this staff account.');
    } finally {
      setUpdatingStaffIds((ids) => ids.filter((id) => id !== member.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900">Staff & Team Account Management</h2>
          <p className="text-xs text-neutral-500">Manage administrator, front desk, owner, housekeeping, and catering accounts.</p>
        </div>

        <button
          onClick={() => {
            resetStaffForm();
            setIsModalOpen(true);
          }}
          className="btn-amber flex items-center gap-2 text-xs"
        >
          <FaUserPlus /> Add New Staff Member
        </button>
      </div>

      <div className="admin-card">
        {staffError && <div className="login-error" role="alert">{staffError}</div>}
        <table className="admin-table staff-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((member) => (
              <tr key={member.id}>
                <td className="font-bold text-neutral-900">
                  {member.firstName} {member.lastName}
                </td>
                <td>{member.email}</td>
                <td>{member.phone || '—'}</td>
                <td>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    member.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {member.role}
                  </span>
                </td>
                <td>
                  <span className={member.status === 'active' ? 'badge-confirmed' : 'badge-inactive'}>
                    {member.status}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(member)}
                    disabled={updatingStaffIds.includes(member.id)}
                    className={`staff-status-action ${member.status === 'active' ? 'is-active' : 'is-inactive'}`}
                  >
                    {updatingStaffIds.includes(member.id) ? 'Saving…' : <>
                      {member.status === 'active' ? <FaUserTimes aria-hidden="true" /> : <FaUserCheck aria-hidden="true" />}
                      {member.status === 'active' ? 'Deactivate' : 'Activate'}
                    </>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="staff-modal-backdrop">
          <div className="staff-modal">
            <div className="staff-modal-heading">
              <div>
                <p className="eyebrow">TEAM ACCESS</p>
                <h3>Create New Staff / Cashier</h3>
                <p className="muted">Set up a secure account for the Admin Client or POS.</p>
              </div>
              <FaUsers className="staff-heading-icon" />
            </div>

            <form onSubmit={handleCreateStaff} className="staff-form">
              <div className="form-section-title">Personal details</div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">First Name</label>
                  <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="form-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Last Name</label>
                  <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="form-input" />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Email Address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Phone Number <span>(optional)</span></label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" />
                </div>
              </div>

              <div className="form-section-title">Role and access</div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="form-input">
                    <option value="cashier">POS Cashier (Restricted)</option>
                    <option value="admin">Administrator (Full Access)</option>
                    <option value="property_owner">Property Owner (Owner Portal)</option>
                    <option value="housekeeping">Housekeeping (Cleaning &amp; Maintenance Portal)</option>
                    <option value="catering">Catering (Food &amp; Refreshments Orders)</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Temporary Password</label>
                  <div className="password-field"><FaKey /><PasswordInput id="staff-temporary-password" label="temporary password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" /></div>
                </div>
              </div>

              <div className="staff-access-note">The staff member should change this temporary password after their first sign-in.</div>

              <div className="staff-form-actions">
                <button
                  type="button"
                  onClick={() => {
                    resetStaffForm();
                    setIsModalOpen(false);
                  }}
                  className="secondary-action"
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action"><FaUserCheck /> Save Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
