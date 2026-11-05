import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaHome, FaSignInAlt } from 'react-icons/fa';
import { getBranding } from '../utils/branding';
import PasswordInput from '../components/PasswordInput';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Login({ onLogin, sessionMessage = '' }) {
  const [branding, setBranding] = useState(getBranding);
  useEffect(() => {
    const refreshBranding = (event) => setBranding(event.detail || getBranding());
    window.addEventListener('rms:branding-changed', refreshBranding);
    return () => window.removeEventListener('rms:branding-changed', refreshBranding);
  }, []);
  const [accountRole, setAccountRole] = useState('cashier');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(sessionMessage);
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryRequested, setRecoveryRequested] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  async function submit(event) {
    if (event) event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: email.trim(),
        password,
        client: 'desktop',
      });
      const data = response.data?.data;
      if (!data?.token) {
        throw new Error('Invalid server authentication response');
      }

      const role = data.user?.role;
      if (!['admin', 'cashier', 'property_owner', 'housekeeping', 'catering'].includes(role)) {
        throw new Error('This portal is available to administrators, cashiers, property owners, housekeeping, and catering staff');
      }
      if (role !== accountRole) {
        const roleLabels = { admin: 'an administrator', cashier: 'a cashier', property_owner: 'a property owner', housekeeping: 'a housekeeping team member', catering: 'a catering team member' };
        throw new Error(`This account is registered as ${roleLabels[role]}. Choose the matching account type.`);
      }

      const authUser = data.user;
      const authToken = data.token;
      sessionStorage.setItem('rms_admin_token', authToken);
      sessionStorage.setItem('rms_admin_user', JSON.stringify(authUser));
      localStorage.setItem('rms_admin_token', authToken);
      localStorage.setItem('rms_admin_user', JSON.stringify(authUser));
      onLogin(authUser);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.response?.data?.message || requestError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function requestRecoveryCode(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setRecoveryLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/staff/forgot-password`, { email: email.trim() });
      setRecoveryRequested(true);
      setNotice(response.data?.message || 'If an active staff account matches that email, a recovery code will be sent.');
    } catch (requestError) {
      setError(requestError.response?.status === 404
        ? 'This backend has not loaded staff password recovery yet. Restart or redeploy the CozyStay API, then try again.'
        : requestError.response?.data?.error || 'Unable to request a recovery code. Try again shortly.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function resetStaffPassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setRecoveryLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/staff/reset-password`, {
        email: email.trim(),
        code: recoveryCode.trim(),
        newPassword,
      });
      setRecoveryMode(false);
      setRecoveryRequested(false);
      setRecoveryCode('');
      setNewPassword('');
      setPassword('');
      setNotice(response.data?.message || 'Password reset. Sign in with your new password.');
    } catch (requestError) {
      setError(requestError.response?.status === 404
        ? 'This backend has not loaded staff password recovery yet. Restart or redeploy the CozyStay API, then try again.'
        : requestError.response?.data?.error || 'The code is invalid or expired. Request a new code and try again.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          {branding.logo ? <img className="login-logo" src={branding.logo} alt={`${branding.name} logo`} /> : <div className="login-logo-fallback"><FaHome /></div>}
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 block">
            {branding.name.toUpperCase()} OWNER & STAFF PORTAL
          </span>
          <h1 className="login-brand-name">{branding.name}</h1>
          <h2 className="login-portal-title">Owner & Operations Portal</h2>
          <p className="text-xs text-neutral-500">
            Sign in to manage your properties, reservations, guest services, or front-desk operations.
          </p>
        </div>

        {recoveryMode ? (
          <form onSubmit={recoveryRequested ? resetStaffPassword : requestRecoveryCode} className="admin-login-form">
            <button type="button" onClick={() => { setRecoveryMode(false); setRecoveryRequested(false); setError(''); setNotice(''); }} className="w-full text-left text-sm font-semibold text-amber-700">
              ← Back to staff sign in
            </button>
            <p className="text-sm text-neutral-600">
              {recoveryRequested
                ? 'Enter the six-digit code sent to your staff email and choose a new password.'
                : 'We will email a one-time recovery code to your staff account.'}
            </p>
            {!recoveryRequested ? (
              <div>
                <label className="block font-bold text-neutral-700 mb-1" htmlFor="recovery-email">Staff Email Address</label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@business.com"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-semibold text-neutral-800"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1" htmlFor="recovery-code">Recovery code</label>
                  <input
                    id="recovery-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-800 tracking-widest"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1" htmlFor="recovery-new-password">New password</label>
                  <PasswordInput
                    id="recovery-new-password"
                    label="new password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Use upper and lower case, a number and a symbol"
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-800"
                  />
                </div>
              </>
            )}
            {notice && !error && <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">{notice}</div>}
            {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl" role="alert">{error}</div>}
            <button type="submit" disabled={recoveryLoading} className="w-full btn-amber py-3 rounded-xl font-extrabold">
              {recoveryLoading ? 'Please wait…' : recoveryRequested ? 'Set New Password' : 'Email Recovery Code'}
            </button>
            {recoveryRequested && (
              <button type="button" disabled={recoveryLoading} onClick={requestRecoveryCode} className="w-full text-sm font-semibold text-amber-700">
                Send a new code
              </button>
            )}
          </form>
        ) : (
        <form onSubmit={submit} className="admin-login-form">
          <div>
            <label className="block font-bold text-neutral-700 mb-1" htmlFor="staff-role">Account type</label>
            <select id="staff-role" value={accountRole} onChange={(event) => setAccountRole(event.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="admin">Administrator</option>
              <option value="property_owner">Property Owner</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="catering">Catering</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-neutral-700 mb-1" htmlFor="staff-email">Staff Email Address</label>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@business.com"
              className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1" htmlFor="staff-password">Password</label>
            <PasswordInput
              id="staff-password"
              label="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {notice && !error && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-semibold flex items-center gap-2">
              <span className="text-amber-600 font-bold">🔒</span>
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-amber py-3 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-md"
          >
            <FaSignInAlt /> {loading ? 'Signing In...' : 'Sign In to Portal'}
          </button>
          <button type="button" onClick={() => { setRecoveryMode(true); setError(''); setNotice(''); }} className="w-full text-sm font-semibold text-amber-700">
            Forgot password?
          </button>
        </form>
        )}

      </div>
    </div>
  );
}
