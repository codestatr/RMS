import React, { useState, useEffect, useRef } from 'react';
import { FaUserPlus, FaUsers, FaUserCheck, FaKey } from 'react-icons/fa';
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';
import { downloadCsv, dateStamp } from '../utils/csvExport';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [createStaffError, setCreateStaffError] = useState('');
  const creatingStaffRef = useRef(false);

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
    if (creatingStaffRef.current) return;

    const hasLowercase = [...password].some((character) => character >= 'a' && character <= 'z');
    const hasUppercase = [...password].some((character) => character >= 'A' && character <= 'Z');
    const hasNumber = [...password].some((character) => character >= '0' && character <= '9');
    const hasSpecialCharacter = [...password].some((character) => '@$!%*?&'.includes(character));
    if (password.length < 8 || !hasLowercase || !hasUppercase || !hasNumber || !hasSpecialCharacter) {
      setCreateStaffError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }

    creatingStaffRef.current = true;
    setIsCreatingStaff(true);
    setCreateStaffError('');
    try {
      await axios.post(`${API_URL}/users`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        password,
      }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || ''}` },
      });
      resetStaffForm();
      setIsModalOpen(false);
      // Keep the create flow ready for another staff member while the table refreshes.
      void loadStaff();
    } catch (err) {
      setCreateStaffError(err.response?.data?.error || err.response?.data?.message || 'Failed to create staff account. Please try again.');
    } finally {
      creatingStaffRef.current = false;
      setIsCreatingStaff(false);
    }
  };

  const exportStaff = () => downloadCsv(`RMS_Staff_Directory_${dateStamp()}.csv`, [
    'Staff ID', 'First name', 'Last name', 'Email', 'Phone', 'Role', 'Status',
  ], staffList.map((member) => [member.id, member.firstName, member.lastName, member.email, member.phone, member.role, member.status]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900">Staff & Team Account Management</h2>
          <p className="text-xs text-neutral-500">Manage administrator, front desk, owner, housekeeping, and catering accounts.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportStaff} disabled={!staffList.length}>Export CSV</button>
          <button
            type="button"
            disabled={isCreatingStaff}
            onClick={() => {
              resetStaffForm();
              setCreateStaffError('');
              setIsModalOpen(true);
            }}
            className="btn-amber flex items-center gap-2 text-xs"
          >
            <FaUserPlus /> Add New Staff Member
          </button>
        </div>
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
              {createStaffError && <div className="staff-create-error" role="alert">{createStaffError}</div>}

              <div className="staff-form-actions">
                <button
                  type="button"
                  disabled={isCreatingStaff}
                  onClick={() => {
                    resetStaffForm();
                    setCreateStaffError('');
                    setIsModalOpen(false);
                  }}
                  className="secondary-action"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isCreatingStaff} className="primary-action">
                  <FaUserCheck /> {isCreatingStaff ? 'Saving account…' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
