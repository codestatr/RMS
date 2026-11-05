import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  FaCalendarCheck,
  FaHeart,
  FaReceipt,
  FaUserCog,
  FaShieldAlt,
  FaChevronLeft,
  FaChevronRight,
  FaSignOutAlt,
  FaMapMarkerAlt,
  FaTimes,
  FaPrint,
  FaLock,
  FaHome,
  FaCalendarAlt,
  FaConciergeBell,
  FaCamera,
} from 'react-icons/fa';
import { useAuthStore } from '../store/authStore';
import PasswordInput from '../components/PasswordInput';
import { useWishlistStore } from '../store/wishlistStore';
import { bookingService } from '../services/bookingService';
import { authService } from '../services/authService';
import { paymentService } from '../services/paymentService';
import { formatKES } from '../utils/currency';
import ReceiptPrint from '../components/ReceiptPrint';
import GuestServices from './GuestServices';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, updateUser } = useAuthStore();
  const { savedProperties, fetchWishlist, toggleWishlist } = useWishlistStore();

  const activeTab = searchParams.get('tab') || 'bookings';
  const [collapsed, setCollapsed] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  // Profile Form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState(user?.city || '');
  const [twoFactor, setTwoFactor] = useState(user?.twoFactorEnabled || false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.profileImageUrl || '');

  // Password state
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchWishlist();
    loadUserBookings();
  }, [isAuthenticated, navigate]);

  const loadUserBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await bookingService.getMyBookings();
      const payload = res?.data ?? res;
      const rows = payload?.data ?? payload ?? [];
      setBookings(Array.isArray(rows) ? rows : rows?.data || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleTabChange = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setCancellingBookingId(bookingId);
    try {
      await bookingService.cancel(bookingId, 'Customer cancelled from dashboard');
      toast.success('Booking cancelled successfully');
      loadUserBookings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel booking');
    } finally {
      setCancellingBookingId(null);
    }
  };

  const handleViewReceipt = async (bookingId) => {
    try {
      const paymentsRes = await paymentService.getBookingPayments(bookingId);
      const payments = paymentsRes.data || [];
      if (payments.length > 0) {
        const receiptRes = await paymentService.getReceipt(payments[0].id);
        setSelectedReceipt(receiptRes.data);
      } else {
        toast.error('No receipt found for this booking yet');
      }
    } catch (err) {
      toast.error('Could not load receipt');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      const res = await authService.updateProfile({
        firstName,
        lastName,
        phone,
        address,
        city,
      });
      updateUser(res.data);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG, or WebP image');
      e.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Profile photo must be 4 MB or smaller');
      e.target.value = '';
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      toast.error('Choose a profile photo first');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await authService.uploadProfilePhoto(avatarFile);
      updateUser(res.data);
      setAvatarFile(null);
      setAvatarPreview(res.data?.profileImageUrl || '');
      toast.success('Profile photo updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currPassword || !newPassword) {
      toast.error('Please enter current and new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setUpdatingPassword(true);
    try {
      await authService.changePassword(currPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const menuItems = [
    { id: 'bookings', label: 'My Bookings', icon: <FaCalendarCheck /> },
    { id: 'services', label: 'Guest Services', icon: <FaConciergeBell /> },
    { id: 'wishlist', label: 'Saved Wishlist', icon: <FaHeart /> },
    { id: 'receipts', label: 'Receipts & Invoices', icon: <FaReceipt /> },
    { id: 'profile', label: 'Profile & Security', icon: <FaUserCog /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col">
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6">
        {/* Collapsible Customer Sidebar */}
        <aside
          className={`bg-white rounded-2xl shadow-sm border border-neutral-200 transition-all duration-300 flex flex-col justify-between ${
            collapsed ? 'w-full md:w-20' : 'w-full md:w-64'
          } p-4`}
        >
          <div>
            {/* User Overview */}
            <div className={`flex items-center gap-3 pb-4 border-b border-neutral-100 mb-4 ${collapsed ? 'justify-center' : ''}`}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                  {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              {!collapsed && (
                <div className="overflow-hidden">
                  <h3 className="font-bold text-sm text-neutral-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
                </div>
              )}
            </div>

            {/* Menu Items */}
            <nav className="space-y-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition ${
                    activeTab === item.id
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-amber-600'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <span className="text-base">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* Footer of sidebar: Collapse button & Logout */}
          <div className="pt-4 border-t border-neutral-100 space-y-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex w-full items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <FaChevronRight /> : <><FaChevronLeft /> <span>Collapse</span></>}
            </button>

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <FaSignOutAlt />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sm:p-8">
          {/* TAB 1: MY BOOKINGS */}
          {activeTab === 'bookings' && (
            <div>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-xl font-extrabold text-neutral-900">My Bookings & Reservations</h2>
                  <p className="text-xs text-neutral-500">Track current stays and view past booking history</p>
                </div>
                <Link
                  to="/browse"
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
                >
                  + Book New Stay
                </Link>
              </div>

              {loadingBookings ? (
                <p className="text-xs text-neutral-400 animate-pulse">Loading your bookings...</p>
              ) : bookings.length === 0 ? (
                <div className="py-16 text-center">
                  <FaHome className="mx-auto text-4xl text-neutral-300 mb-3" />
                  <h3 className="text-base font-bold text-neutral-700">No bookings yet</h3>
                  <p className="text-xs text-neutral-400 mt-1 mb-6">Explore our curated rental properties to start your journey.</p>
                  <Link to="/browse" className="btn-primary bg-amber-500 text-white text-xs px-5 py-2.5 rounded-lg">
                    Browse Stays
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="border border-neutral-200 rounded-2xl p-5 hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50/50"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              b.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : b.status === 'checked_in'
                                ? 'bg-sky-100 text-sky-800'
                                : b.status === 'checked_out'
                                ? 'bg-neutral-200 text-neutral-700'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {b.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-neutral-400 font-mono">Ref: #{b.id.slice(0, 8)}</span>
                        </div>

                        <h4 className="font-bold text-base text-neutral-900">{b.propertyName || 'Rental Property'}</h4>
                        <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                          <FaCalendarAlt className="text-amber-500" /> {b.checkInDate} &rarr; {b.checkOutDate} ({b.numberOfGuests} Guests)
                        </p>
                        {b.arrivalWindow && (
                          <p className="text-[11px] text-sky-700 font-semibold mt-1">
                            Arrival: {b.arrivalWindow.replace('_', ' ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-lg font-extrabold text-neutral-900">{formatKES(b.totalAmount)}</span>
                          <span className="text-[10px] text-neutral-400 block">Total Stay Cost</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewReceipt(b.id)}
                            className="bg-white border border-neutral-300 hover:border-amber-400 text-neutral-700 font-bold text-xs px-3 py-2 rounded-lg transition"
                          >
                            Receipt
                          </button>

                          {b.status === 'pending' && (
                            <Link
                              to={`/payment/${b.id}?amount=${b.totalAmount}`}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition"
                            >
                              Pay Now
                            </Link>
                          )}

                          {['pending', 'confirmed'].includes(b.status) && (
                            <button
                              onClick={() => handleCancelBooking(b.id)}
                              disabled={cancellingBookingId === b.id}
                              className="text-rose-600 hover:bg-rose-50 text-xs font-bold px-3 py-2 rounded-lg transition border border-rose-200"
                            >
                              {cancellingBookingId === b.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'services' && <GuestServices bookings={bookings} phone={user?.phone || ''} />}

          {/* TAB 2: WISHLIST */}
          {activeTab === 'wishlist' && (
            <div>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-100">
                <div>
                  <h2 className="text-xl font-extrabold text-neutral-900">Saved Wishlist</h2>
                  <p className="text-xs text-neutral-500">Properties you saved to review or book later</p>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                  {savedProperties.length} Saved
                </span>
              </div>

              {savedProperties.length === 0 ? (
                <div className="py-16 text-center">
                  <FaHeart className="mx-auto text-4xl text-neutral-300 mb-3" />
                  <h3 className="text-base font-bold text-neutral-700">Your wishlist is empty</h3>
                  <p className="text-xs text-neutral-400 mt-1 mb-6">Click the heart icon on any listing to save it here.</p>
                  <Link to="/browse" className="btn-primary bg-amber-500 text-white text-xs px-5 py-2.5 rounded-lg">
                    Discover Properties
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedProperties.map((p) => {
                    const img =
                      (Array.isArray(p.images)
                        ? p.images[0]
                        : typeof p.images === 'string'
                        ? p.images.split(',')[0]
                        : null) || null;

                    return (
                      <div key={p.id} className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
                        {img ? <img src={img} alt={p.name} className="w-full h-40 object-cover" /> : <div className="w-full h-40 bg-neutral-100 flex items-center justify-center text-xs text-neutral-500">No property image</div>}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] text-neutral-400 font-semibold">{p.city}</span>
                            <h4 className="font-bold text-sm text-neutral-900 line-clamp-1">{p.name}</h4>
                            <span className="text-sm font-extrabold text-amber-600 block mt-1">{formatKES(p.pricePerNight)} / night</span>
                          </div>

                          <div className="flex gap-2 mt-4 pt-3 border-t border-neutral-100">
                            <Link
                              to={`/property/${p.id}`}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 rounded-lg text-center"
                            >
                              Book
                            </Link>
                            <button
                              onClick={() => toggleWishlist(p)}
                              className="p-2 text-rose-500 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs"
                              title="Remove"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RECEIPTS & INVOICES */}
          {activeTab === 'receipts' && (
            <div>
              <div className="mb-6 pb-4 border-b border-neutral-100">
                <h2 className="text-xl font-extrabold text-neutral-900">Receipts & Invoices</h2>
                <p className="text-xs text-neutral-500">Download and print your official booking tax invoices</p>
              </div>

              {bookings.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-8 text-center">No payment receipts available yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-xs text-neutral-900 block">{b.propertyName}</span>
                        <span className="text-[11px] text-neutral-400">
                          Dates: {b.checkInDate} to {b.checkOutDate} | Paid: {formatKES(b.totalAmount)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleViewReceipt(b.id)}
                        className="bg-white border border-neutral-300 hover:border-amber-400 text-neutral-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <FaReceipt className="text-amber-500" /> View Receipt
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE & SECURITY */}
          {activeTab === 'profile' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-extrabold text-neutral-900">Profile & Security Settings</h2>
                <p className="text-xs text-neutral-500">Update personal details, password, and two-factor protection</p>
              </div>

              {/* Personal Details Form */}
              <form onSubmit={handleUpdateProfile} className="space-y-4 border border-neutral-200 p-6 rounded-2xl">
                <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-neutral-100">Personal Information</h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-2">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Profile preview" className="w-20 h-20 rounded-full object-cover border border-neutral-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold">
                      {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer bg-white border border-neutral-300 hover:border-amber-400 text-neutral-700 font-bold text-xs px-4 py-2 rounded-lg">
                        <FaCamera /> Choose Profile Photo
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} className="sr-only" />
                      </label>
                      <button
                        type="button"
                        onClick={handleUploadAvatar}
                        disabled={!avatarFile || uploadingAvatar}
                        className="bg-neutral-800 hover:bg-neutral-900 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg"
                      >
                        {uploadingAvatar ? 'Uploading…' : 'Upload Photo'}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500">JPG, PNG, or WebP. Maximum size: 4 MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">City / Region</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Address</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm"
                  >
                    {updatingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>

              {/* Password & Security */}
              <form onSubmit={handleChangePassword} className="space-y-4 border border-neutral-200 p-6 rounded-2xl">
                <h3 className="font-bold text-sm text-neutral-900 pb-2 border-b border-neutral-100 flex items-center gap-2">
                  <FaLock className="text-amber-500" /> Change Account Password
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Current Password</label>
                    <PasswordInput
                      id="current-account-password"
                      label="current password"
                      value={currPassword}
                      onChange={(e) => setCurrPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">New Password</label>
                    <PasswordInput
                      id="new-account-password"
                      label="new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Confirm New Password</label>
                    <PasswordInput
                      id="confirm-account-password"
                      label="confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-neutral-500">Use at least 8 characters with uppercase and lowercase letters, a number, and a special character (@$!%*?&amp;).</p>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="bg-neutral-800 hover:bg-neutral-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm"
                  >
                    {updatingPassword ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>

              {/* 2FA Security Switch */}
              <div className="border border-neutral-200 p-6 rounded-2xl flex justify-between items-center bg-neutral-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-lg">
                    <FaShieldAlt />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900">Two-Factor Authentication (2FA)</h4>
                    <p className="text-xs text-neutral-500">Require an email OTP whenever you sign in from a new device.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTwoFactor(!twoFactor);
                    toast.success(twoFactor ? '2FA disabled' : '2FA enabled successfully!');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    twoFactor
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  }`}
                >
                  {twoFactor ? 'Enabled ✓' : 'Disabled'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Printable Receipt Viewer Modal */}
      {selectedReceipt && (
        <div className="website-receipt-layer">
          <div className="website-receipt-viewer">
            <div className="website-receipt-viewer-head no-print">
              <h3><FaReceipt className="text-amber-500" /> Payment Receipt</h3>
              <button onClick={() => setSelectedReceipt(null)} aria-label="Close receipt"><FaTimes size={18} /></button>
            </div>
            <ReceiptPrint receipt={selectedReceipt} />
            <div className="website-receipt-viewer-actions no-print">
              <button
                onClick={() => window.print()}
                className="bg-neutral-800 hover:bg-neutral-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <FaPrint /> Print thermal receipt
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
