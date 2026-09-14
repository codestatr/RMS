import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaUsers, FaUserCheck, FaUserTimes, FaKey } from 'react-icons/fa';
import axios from 'axios';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New staff form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('cashier');
  const [password, setPassword] = useState('Cashier123!');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const resetStaffForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('cashier');
    setPassword('Cashier123!');
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
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      const allUsers = res.data?.data?.data || [];
      setStaffList(allUsers.filter((u) => ['admin', 'cashier'].includes(u.role)));
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
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}` },
      });
      alert('Staff account created successfully!');
      setIsModalOpen(false);
      resetStaffForm();
      await loadStaff();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create staff account');
    }
  };

  const handleToggleStatus = (member) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    setStaffList(
      staffList.map((s) => (s.id === member.id ? { ...s, status: newStatus } : s))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900">Staff & Cashier Account Management</h2>
          <p className="text-xs text-neutral-500">Manage administrator privileges and front-desk POS cashier logins.</p>
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
        <table className="admin-table">
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
                    onClick={() => handleToggleStatus(member)}
                    className="text-xs font-semibold text-neutral-600 hover:text-amber-600"
                  >
                    {member.status === 'active' ? 'Deactivate' : 'Activate'}
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
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Temporary Password</label>
                  <div className="password-field"><FaKey /><input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" /></div>
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
