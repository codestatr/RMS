import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaHome, FaUser, FaEnvelope, FaLock, FaPhone, FaUserPlus } from 'react-icons/fa';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { register, login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters with upper, lower, and numbers');
      return;
    }

    const regRes = await register({
      email,
      password,
      firstName,
      lastName,
      phone,
    });

    if (regRes.success) {
      toast.success('Account created successfully! Logging you in...');
      // Auto login
      const loginRes = await login(email, password);
      if (loginRes.success && !loginRes.requires2FA) {
        navigate('/dashboard');
      } else {
        toast.error(loginRes.error || 'Account created, but automatic login failed. Please sign in.');
        navigate('/login');
      }
    } else {
      toast.error(regRes.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-3xl font-extrabold text-amber-500 mb-2">
          <img src="/rms-logo.svg" alt="RMS Properties logo" className="h-10 w-10 rounded-xl object-cover border border-amber-200 shadow-sm" />
          <span className="text-neutral-900">RMS Properties</span>
        </Link>
        <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Create your guest account</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-amber-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-xl border border-neutral-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <FaUser className="absolute left-3 top-3 text-neutral-400 text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <FaEnvelope className="absolute left-3 top-3 text-neutral-400 text-xs" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Phone Number (M-Pesa / SMS)</label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+254 700 000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <FaPhone className="absolute left-3 top-3 text-neutral-400 text-xs" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <FaLock className="absolute left-3 top-3 text-neutral-400 text-xs" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mt-4"
            >
              <FaUserPlus /> {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
