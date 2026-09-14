import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaHome, FaHeart, FaUser, FaSignOutAlt, FaCalendarCheck } from 'react-icons/fa';
import { useAuthStore } from '../store/authStore';
import { useWishlistStore } from '../store/wishlistStore';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { savedProperties, fetchWishlist } = useWishlistStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated, fetchWishlist]);

  // Close menus on route change
  useEffect(() => {
    setIsOpen(false);
    setUserDropdown(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 text-2xl font-bold text-amber-500 hover:text-amber-600 transition">
            <img src="/rms-logo.svg" alt="RMS Logo" className="h-10 w-10 rounded-xl object-cover shadow-sm border border-amber-200" />
            <span className="tracking-tight text-neutral-900 font-extrabold">
              RMS <span className="text-amber-500 font-medium text-lg">Properties</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 font-medium text-neutral-600 text-sm">
            <Link
              to="/"
              className={`hover:text-amber-500 transition ${location.pathname === '/' ? 'text-amber-500 font-semibold' : ''}`}
            >
              Home
            </Link>
            <Link
              to="/browse"
              className={`hover:text-amber-500 transition ${location.pathname.startsWith('/browse') ? 'text-amber-500 font-semibold' : ''}`}
            >
              Browse Listings
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/dashboard?tab=bookings"
                  className={`hover:text-amber-500 transition flex items-center gap-1.5 ${location.search.includes('bookings') ? 'text-amber-500 font-semibold' : ''}`}
                >
                  <FaCalendarCheck className="text-amber-500" />
                  My Bookings
                </Link>
                <Link
                  to="/dashboard?tab=wishlist"
                  className="hover:text-amber-500 transition flex items-center gap-1.5 relative"
                >
                  <FaHeart className="text-rose-500" />
                  <span>Wishlist</span>
                  {savedProperties.length > 0 && (
                    <span className="bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                      {savedProperties.length}
                    </span>
                  )}
                </Link>
              </>
            )}
          </nav>

          {/* Right Section: Auth & User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdown(!userDropdown)}
                  className="flex items-center gap-2.5 py-1.5 px-3 rounded-full border border-neutral-200 hover:border-amber-400 transition bg-neutral-50"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <FaUser size={12} />}
                  </div>
                  <span className="text-sm font-semibold text-neutral-800">
                    {user?.firstName || 'My Account'}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {userDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-neutral-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-neutral-100">
                      <p className="text-xs text-neutral-400 font-medium">Signed in as</p>
                      <p className="text-sm font-semibold text-neutral-900 truncate">{user?.email}</p>
                      <span className="inline-block mt-1 text-[11px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full capitalize">
                        {user?.role || 'Customer'}
                      </span>
                    </div>

                    <Link
                      to="/dashboard"
                      onClick={() => setUserDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-amber-50 hover:text-amber-600 transition"
                    >
                      <FaUser className="text-neutral-400" /> Account Dashboard
                    </Link>

                    <Link
                      to="/dashboard?tab=bookings"
                      onClick={() => setUserDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-amber-50 hover:text-amber-600 transition"
                    >
                      <FaCalendarCheck className="text-neutral-400" /> My Bookings
                    </Link>

                    <Link
                      to="/dashboard?tab=wishlist"
                      onClick={() => setUserDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-amber-50 hover:text-amber-600 transition"
                    >
                      <FaHeart className="text-rose-400" /> Saved Wishlist
                    </Link>

                    <div className="border-t border-neutral-100 my-1"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
                    >
                      <FaSignOutAlt /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-neutral-700 hover:text-amber-600 px-3 py-2 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-neutral-900 bg-amber-400 hover:bg-amber-500 px-4 py-2 rounded-lg shadow-sm transition"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-neutral-700 hover:bg-neutral-100 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {isOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <Link
            to="/"
            className="block px-3 py-2 rounded-md font-medium text-neutral-800 hover:bg-amber-50 hover:text-amber-600"
          >
            Home
          </Link>
          <Link
            to="/browse"
            className="block px-3 py-2 rounded-md font-medium text-neutral-800 hover:bg-amber-50 hover:text-amber-600"
          >
            Browse All Properties
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="block px-3 py-2 rounded-md font-medium text-neutral-800 hover:bg-amber-50 hover:text-amber-600"
              >
                Dashboard
              </Link>
              <Link
                to="/dashboard?tab=bookings"
                className="block px-3 py-2 rounded-md font-medium text-neutral-800 hover:bg-amber-50 hover:text-amber-600"
              >
                My Bookings
              </Link>
              <Link
                to="/dashboard?tab=wishlist"
                className="block px-3 py-2 rounded-md font-medium text-neutral-800 hover:bg-amber-50 hover:text-amber-600"
              >
                Wishlist ({savedProperties.length})
              </Link>
              <div className="pt-2 border-t border-neutral-200">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-md font-medium text-rose-600 hover:bg-rose-50"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="pt-4 border-t border-neutral-200 flex gap-2">
              <Link
                to="/login"
                className="flex-1 text-center py-2 px-3 border border-neutral-300 rounded-lg text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="flex-1 text-center py-2 px-3 bg-amber-400 hover:bg-amber-500 rounded-lg text-sm font-semibold text-neutral-900 shadow-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
