import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaLock, FaSignInAlt, FaKey } from 'react-icons/fa';
import PasswordInput from '../components/PasswordInput';
import { useAuthStore } from '../store/authStore';
import { getPendingBooking } from '../utils/pendingBooking';
import toast from 'react-hot-toast';
import { useBranding } from '../contexts/BrandingContext';

export default function Login() {
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState('');
  const { login, verifyOtp, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const pendingBooking = getPendingBooking();
  const from = pendingBooking ? `/booking/${pendingBooking.propertyId}` : (location.state?.from?.pathname || '/dashboard');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    const res = await login(email, password);
    if (res.success) {
      if (res.requires2FA) {
        setIsOtpMode(true);
        setTempToken(res.tempToken);
        toast.success(res.message || 'Please check your email for the OTP code');
      } else {
        toast.success(`Welcome back, ${res.user.firstName}!`);
        navigate(from, { replace: true });
      }
    } else {
      toast.error(res.error || 'Invalid credentials');
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp) {
      toast.error('Please enter the OTP code');
      return;
    }

    const res = await verifyOtp(tempToken, otp);
    if (res.success) {
      toast.success(`Welcome back, ${res.user.firstName}!`);
      navigate(from, { replace: true });
    } else {
      toast.error(res.error || 'Invalid OTP code');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex flex-col items-center gap-2 text-3xl font-extrabold text-amber-500 mb-3">
          <img src={branding.logo || '/rms-logo.svg'} alt={`${branding.brandName} logo`} className="customer-login-logo" />
          <span className="text-neutral-900">{branding.brandName}</span>
        </Link>
        <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Sign in to your account</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Or{' '}
          <Link to="/register" className="font-bold text-amber-600 hover:underline">
            create a new customer account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-xl border border-neutral-200">
          {!isOtpMode && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <FaEnvelope className="absolute left-3.5 top-3 text-neutral-400 text-xs" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Password</label>
              <div className="relative">
                <PasswordInput
                  id="customer-login-password"
                  label="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <FaLock className="absolute left-3.5 top-3 text-neutral-400 text-xs" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
            >
              <FaSignInAlt /> {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          )}
          {isOtpMode && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-neutral-600">Enter the 6-digit verification code sent to your email.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1">Verification Code (OTP)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-lg text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center tracking-widest"
                />
                <FaKey className="absolute left-3.5 top-3.5 text-neutral-400 text-sm" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
            >
              <FaSignInAlt /> {isLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => setIsOtpMode(false)} className="text-xs text-amber-600 hover:underline">
                Back to login
              </button>
            </div>
          </form>
          )}

        </div>
      </div>
    </div>
  );
}
