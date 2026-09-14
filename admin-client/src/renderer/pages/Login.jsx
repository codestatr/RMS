import React, { useState } from 'react';
import axios from 'axios';
import { FaHome, FaSignInAlt, FaCashRegister, FaUserShield } from 'react-icons/fa';
import { getBranding } from '../utils/branding';
import { shouldUseOfflineFallback } from '../../utils/authFallback';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Login({ onLogin, sessionMessage = '' }) {
  const branding = getBranding();
  const [email, setEmail] = useState('cashier@rms.com');
  const [password, setPassword] = useState('Cashier123!');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(sessionMessage);
  const [loading, setLoading] = useState(false);

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
      if (role !== 'admin' && role !== 'cashier') {
        throw new Error('Only administrator and cashier staff accounts can use this portal');
      }

      const authUser = data.user;
      const authToken = data.token;
      sessionStorage.setItem('rms_admin_token', authToken);
      sessionStorage.setItem('rms_admin_user', JSON.stringify(authUser));
      localStorage.setItem('rms_admin_token', authToken);
      localStorage.setItem('rms_admin_user', JSON.stringify(authUser));
      onLogin(authUser);
    } catch (requestError) {
      // Only use offline demo login when the backend is genuinely unreachable.
      if (shouldUseOfflineFallback(requestError, email, password)) {
        const fallbackUser = {
          id: email === 'admin@rms.com' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222',
          email,
          firstName: email === 'admin@rms.com' ? 'System' : 'Alice',
          lastName: email === 'admin@rms.com' ? 'Administrator' : 'Mwangi',
          role: email === 'admin@rms.com' ? 'admin' : 'cashier',
        };
        const fallbackToken = 'local_offline_token_' + Date.now();
        sessionStorage.setItem('rms_admin_token', fallbackToken);
        sessionStorage.setItem('rms_admin_user', JSON.stringify(fallbackUser));
        localStorage.setItem('rms_admin_token', fallbackToken);
        localStorage.setItem('rms_admin_user', JSON.stringify(fallbackUser));
        onLogin(fallbackUser);
        return;
      }

      setError(requestError.response?.data?.error || requestError.response?.data?.message || requestError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  const handleQuickDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          {branding.logo ? <img className="login-logo" src={branding.logo} alt={`${branding.name} logo`} /> : <div className="login-logo-fallback"><FaHome /></div>}
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 block">
            RMS DESKTOP CLIENT
          </span>
          <h1 className="login-brand-name">{branding.name}</h1>
          <h2 className="login-portal-title">Admin & Cashier Portal</h2>
          <p className="text-xs text-neutral-500">
            Sign in with your staff account to access front-desk POS terminal or admin management.
          </p>
        </div>

        <form onSubmit={submit} className="admin-login-form">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Staff Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cashier@rms.com"
              className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Password</label>
            <input
              type="password"
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
        </form>

        {/* Quick Demo Logins */}
        <div className="admin-login-demo">
          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block text-center">
            One-Click Demo Staff Logins
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('cashier@rms.com', 'Cashier123!')}
              className="p-2 border border-neutral-200 hover:border-amber-400 rounded-xl text-center text-xs font-bold text-neutral-700 hover:bg-amber-50/50 transition flex items-center justify-center gap-1.5"
            >
              <FaCashRegister className="text-amber-500" /> POS Cashier
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin@rms.com', 'Admin123!')}
              className="p-2 border border-neutral-200 hover:border-sky-400 rounded-xl text-center text-xs font-bold text-neutral-700 hover:bg-sky-50/50 transition flex items-center justify-center gap-1.5"
            >
              <FaUserShield className="text-sky-500" /> System Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
