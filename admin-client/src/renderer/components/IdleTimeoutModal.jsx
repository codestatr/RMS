import React from 'react';
import { FiClock, FiAlertTriangle, FiLogOut, FiCheckCircle } from 'react-icons/fi';

/**
 * IdleTimeoutModal
 * Warning modal that appears 30 seconds before auto-logout after 4 minutes of idle time.
 */
export default function IdleTimeoutModal({ isOpen, remainingSeconds, onExtend, onLogout }) {
  if (!isOpen) return null;

  const percentage = Math.max(0, Math.min(100, (remainingSeconds / 30) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <FiClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Session Inactivity Warning</h3>
              <p className="text-amber-100 text-xs">Security auto-logout policy</p>
            </div>
          </div>
          <span className="text-xs bg-amber-700/60 px-2 py-0.5 rounded-full font-mono font-semibold">
            4 min idle
          </span>
        </div>

        {/* Body */}
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <FiAlertTriangle className="w-8 h-8 text-amber-600 animate-bounce" />
          </div>

          <h4 className="text-lg font-bold text-neutral-900 mb-2">
            Are you still there?
          </h4>
          <p className="text-sm text-neutral-600 mb-5">
            For security, your session will automatically log out after <span className="font-semibold text-neutral-800">4 minutes of inactivity</span>.
          </p>

          {/* Countdown Clock Display */}
          <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 mb-5">
            <div className="text-3xl font-extrabold font-mono text-amber-600 mb-1">
              00:{remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds}
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              Seconds remaining before auto-logout
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onLogout}
              className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-200 text-neutral-700 font-semibold text-sm hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
            >
              <FiLogOut className="w-4 h-4" />
              Log Out Now
            </button>
            <button
              onClick={onExtend}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <FiCheckCircle className="w-4 h-4" />
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
