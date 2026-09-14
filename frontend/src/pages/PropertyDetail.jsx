import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaMapMarkerAlt,
  FaStar,
  FaHeart,
  FaRegHeart,
  FaCheck,
  FaCalendarAlt,
  FaUserFriends,
  FaShieldAlt,
  FaCommentAlt,
  FaExternalLinkAlt,
  FaTimes,
} from 'react-icons/fa';
import { propertyService } from '../services/propertyService';
import { reviewService } from '../services/reviewService';
import { bookingService } from '../services/bookingService';
import { useWishlistStore } from '../store/wishlistStore';
import { useBookingStore } from '../store/bookingStore';
import { useAuthStore } from '../store/authStore';
import { formatKES } from '../utils/currency';
import { savePendingBooking } from '../utils/pendingBooking';
import toast from 'react-hot-toast';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { isSaved, toggleWishlist } = useWishlistStore();
  const { setDraftBooking } = useBookingStore();

  const [property, setProperty] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewableBookings, setReviewableBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Reservation Widget State
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [conflictingBookings, setConflictingBookings] = useState([]);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [selectedReviewBookingId, setSelectedReviewBookingId] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [propRes, revRes] = await Promise.all([
          propertyService.getById(id),
          reviewService.getByProperty(id),
        ]);
        setProperty(propRes.data);
        setReviews(revRes.data?.data || []);

        if (isAuthenticated) {
          const bookingRes = await bookingService.getMyBookings('checked_out', 1, 100);
          const eligibleBookings = (bookingRes.data?.data || []).filter(
            (booking) => (booking.propertyId || booking.property_id) === id
          );
          setReviewableBookings(eligibleBookings);
          setSelectedReviewBookingId(eligibleBookings[0]?.id || '');
        }

        // Default dates: tomorrow to +3 days
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const next3Days = new Date();
        next3Days.setDate(next3Days.getDate() + 4);

        setCheckInDate(tomorrow.toISOString().split('T')[0]);
        setCheckOutDate(next3Days.toISOString().split('T')[0]);
      } catch (err) {
        toast.error('Failed to load property details');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Live Availability Check
  useEffect(() => {
    async function verifyDates() {
      if (checkInDate && checkOutDate && checkInDate < checkOutDate) {
        setIsCheckingAvailability(true);
        try {
          const res = await propertyService.checkAvailability(id, checkInDate, checkOutDate);
          setIsAvailable(Boolean(res.data?.isAvailable));
          setConflictingBookings(res.data?.conflictingBookings || []);
        } catch {
          setIsAvailable(true);
          setConflictingBookings([]);
        } finally {
          setIsCheckingAvailability(false);
        }
      }
    }
    if (id) verifyDates();
  }, [id, checkInDate, checkOutDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <p className="font-bold text-neutral-600">Property not found.</p>
      </div>
    );
  }

  const images =
    property.images && property.images.length > 0
      ? property.images
      : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'];

  const nights =
    checkInDate && checkOutDate
      ? Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)))
      : 1;

  const basePrice = (property.pricePerNight || 5500) * nights;
  const vatTax = Math.round(basePrice * 0.16);
  const totalPrice = basePrice + vatTax;

  const latestConflictCheckout = conflictingBookings
    .map((booking) => booking.check_out_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const canAttemptReservation = Boolean(property && checkInDate && checkOutDate && !isCheckingAvailability);

  const suggestedCheckIn = latestConflictCheckout
    ? latestConflictCheckout.slice(0, 10)
    : null;
  const suggestedCheckOut = suggestedCheckIn
    ? new Date(`${suggestedCheckIn}T00:00:00`)
    : null;
  if (suggestedCheckOut) suggestedCheckOut.setDate(suggestedCheckOut.getDate() + nights);
  const suggestedCheckOutValue = suggestedCheckOut?.toISOString().slice(0, 10) || null;

  const handleReserve = () => {
    if (!isAuthenticated) {
      toast.error('Please log in to proceed with booking');
      navigate('/login', { state: { from: { pathname: `/property/${id}` } } });
      return;
    }

    if (!isAvailable) {
      toast.error('This property is not available for selected dates');
      return;
    }

    const draft = {
      propertyId: property.id,
      property,
      checkInDate,
      checkOutDate,
      numberOfGuests: guestCount,
      totalAmount: totalPrice,
      nights,
    };

    setDraftBooking(draft);
    savePendingBooking(draft);
    navigate(`/booking/${property.id}`);
  };

  const handleCreateReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please log in to leave a review');
      return;
    }

    try {
      const res = await reviewService.create({
        propertyId: property.id,
        bookingId: selectedReviewBookingId,
        rating: newRating,
        title: newTitle,
        comment: newComment,
      });
      setReviewableBookings(reviewableBookings.filter((booking) => booking.id !== selectedReviewBookingId));
      setIsReviewModalOpen(false);
      toast.success('Thank you! Your verified review is awaiting approval.');
      setNewTitle('');
      setNewComment('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Title & Location Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
              {property.type?.replace('_', ' ')}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mt-2">
              {property.name}
            </h1>
            <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-1 font-medium">
              <FaMapMarkerAlt className="text-amber-500" /> {property.address}, {property.city}, {property.country || 'Kenya'}
            </p>
          </div>

          <button
            onClick={() => toggleWishlist(property)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-2xl shadow-sm text-xs font-bold text-neutral-700 hover:text-rose-600 transition"
          >
            {isSaved(property.id) ? (
              <>
                <FaHeart className="text-rose-500" /> Saved to Wishlist
              </>
            ) : (
              <>
                <FaRegHeart /> Save to Wishlist
              </>
            )}
          </button>
        </div>

        {/* Dynamic Image Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 h-96 sm:h-[450px] rounded-3xl overflow-hidden shadow-md">
            <img
              src={images[selectedImageIndex]}
              alt={property.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="md:col-span-1 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto max-h-[450px]">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImageIndex(idx)}
                className={`relative flex-shrink-0 w-24 h-24 md:w-full md:h-28 rounded-2xl overflow-hidden border-2 transition ${
                  selectedImageIndex === idx ? 'border-amber-500 shadow-md' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Details + Sticky Reservation Box */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Description, Amenities, Map, Reviews */}
          <div className="lg:col-span-2 space-y-8">
            {/* Highlights */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-lg font-extrabold text-neutral-900">About this Accommodation</h2>
              <p className="text-xs text-neutral-600 leading-relaxed">{property.description}</p>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-100 text-center">
                <div className="p-3 bg-neutral-50 rounded-2xl">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Capacity</span>
                  <span className="text-sm font-extrabold text-neutral-800">{property.capacity || 2} Guests</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Bedrooms</span>
                  <span className="text-sm font-extrabold text-neutral-800">{property.bedrooms || 1} Room(s)</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Bathrooms</span>
                  <span className="text-sm font-extrabold text-neutral-800">{property.bathrooms || 1} Bath(s)</span>
                </div>
              </div>
            </div>

            {/* Amenities Grid */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-lg font-extrabold text-neutral-900">What this Place Offers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(property.amenities && property.amenities.length > 0
                  ? property.amenities
                  : ['High-Speed Wi-Fi', 'Air Conditioning', 'Dedicated Workspace', 'Free Parking', 'Kitchen', '24/7 Security']
                ).map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-xl text-xs font-semibold text-neutral-700"
                  >
                    <FaCheck className="text-emerald-500 flex-shrink-0" />
                    <span>{typeof amenity === 'string' ? amenity : amenity.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Map & Live Geographic Coordinates */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-extrabold text-neutral-900">Location & Coordinates</h2>
                {property.latitude && property.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    Open in Google Maps <FaExternalLinkAlt size={10} />
                  </a>
                )}
              </div>

              <div className="h-64 rounded-2xl bg-neutral-100 border border-neutral-200 relative overflow-hidden flex flex-col items-center justify-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg mb-2">
                  <FaMapMarkerAlt />
                </div>
                <h4 className="font-bold text-sm text-neutral-900">{property.address}</h4>
                <p className="text-xs text-neutral-500">{property.city}, {property.country || 'Kenya'}</p>
                <div className="mt-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-mono text-neutral-600 border border-neutral-200">
                  Lat: {property.latitude || '-1.2663'} | Lng: {property.longitude || '36.8049'}
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <div>
                  <h2 className="text-lg font-extrabold text-neutral-900">Verified Guest Reviews & Ratings</h2>
                  <p className="text-xs text-neutral-500">
                    {reviews.length} verified ratings ({property.rating || '5.0'} / 5.0)
                  </p>
                </div>

                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  disabled={reviewableBookings.length === 0}
                  title={reviewableBookings.length === 0 ? 'Complete a stay here before reviewing' : 'Write a verified review'}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm"
                >
                  Write a Review
                </button>
              </div>

              {reviews.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No reviews yet for this listing. Be the first to review!</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                            {rev.customerName ? rev.customerName.charAt(0).toUpperCase() : 'G'}
                          </div>
                          <span className="font-bold text-xs text-neutral-900">
                            {rev.customerName || 'Verified Guest'}
                          </span>
                          {rev.verifiedStay && <span className="text-[10px] font-bold text-emerald-700">Verified stay</span>}
                        </div>
                        <div className="flex text-amber-500 text-xs">
                          {[...Array(rev.rating || 5)].map((_, i) => (
                            <FaStar key={i} />
                          ))}
                        </div>
                      </div>

                      {rev.title && <h4 className="font-bold text-xs text-neutral-800">{rev.title}</h4>}
                      <p className="text-xs text-neutral-600">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Booking Widget (in KES) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl border border-neutral-200 p-6 sticky top-24 space-y-6">
              <div className="flex justify-between items-end pb-4 border-b border-neutral-100">
                <div>
                  <span className="text-2xl font-black text-neutral-900">{formatKES(property.pricePerNight)}</span>
                  <span className="text-xs text-neutral-400 font-semibold"> / night</span>
                </div>
                <div className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                  <FaStar /> {property.rating || '5.0'}
                </div>
              </div>

              {/* Date Pickers */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      Check-In Date
                    </label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-neutral-800 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      Check-Out Date
                    </label>
                    <input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-neutral-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    Number of Guests
                  </label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full bg-transparent text-xs font-bold text-neutral-800 focus:outline-none"
                  >
                    {[...Array(property.capacity || 2)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} Guest{i > 0 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Availability Status */}
              <div className="text-xs">
                {isCheckingAvailability ? (
                  <span className="text-neutral-400 animate-pulse">Checking live calendar...</span>
                ) : isAvailable ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <FaCheck /> Available for selected dates!
                  </span>
                ) : (
                  <div className="space-y-2">
                    <span className="text-rose-600 font-bold block">
                      ⚠️ Selected dates are currently reserved.
                    </span>
                    {suggestedCheckIn && suggestedCheckOutValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setCheckInDate(suggestedCheckIn);
                          setCheckOutDate(suggestedCheckOutValue);
                        }}
                        className="text-left text-sky-700 font-bold hover:text-sky-900 underline"
                      >
                        Try available dates: {suggestedCheckIn} to {suggestedCheckOutValue}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Price Calculation Breakdown in KES */}
              <div className="space-y-2 text-xs text-neutral-600 border-t border-neutral-100 pt-4">
                <div className="flex justify-between">
                  <span>
                    {formatKES(property.pricePerNight)} x {nights} night(s)
                  </span>
                  <span className="font-semibold text-neutral-800">{formatKES(basePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>16% VAT Tax</span>
                  <span className="font-semibold text-neutral-800">{formatKES(vatTax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-black text-neutral-900">
                  <span>Grand Total</span>
                  <span className="text-amber-600">{formatKES(totalPrice)}</span>
                </div>
              </div>

              {/* Reserve Button */}
              <button
                type="button"
                onClick={handleReserve}
                disabled={!canAttemptReservation}
                className={`w-full py-4 rounded-2xl font-extrabold text-sm shadow-md transition ${
                  canAttemptReservation && isAvailable
                    ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {isCheckingAvailability
                  ? 'Checking availability...'
                  : isAvailable
                    ? 'Reserve & Continue'
                    : 'Select different dates'}
              </button>

              {!isAvailable && suggestedCheckIn && suggestedCheckOutValue && (
                <button
                  type="button"
                  onClick={() => {
                    setCheckInDate(suggestedCheckIn);
                    setCheckOutDate(suggestedCheckOutValue);
                  }}
                  className="w-full mt-2 py-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 font-bold text-xs hover:bg-sky-100 transition"
                >
                  Use suggested dates: {suggestedCheckIn} to {suggestedCheckOutValue}
                </button>
              )}

              <div className="text-center">
                <p className="text-[11px] text-neutral-400">You won't be charged yet in this step</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Write a Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-200">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-100 mb-4">
              <h3 className="font-extrabold text-base text-neutral-900">Write a Review</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <FaTimes size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-600 mb-1">Completed Stay</label>
                <select
                  value={selectedReviewBookingId}
                  onChange={(e) => setSelectedReviewBookingId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl"
                >
                  <option value="">Select the stay you are reviewing</option>
                  {reviewableBookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.checkInDate || booking.check_in_date} to {booking.checkOutDate || booking.check_out_date}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-neutral-600 mb-1">Star Rating</label>
                <select
                  value={newRating}
                  onChange={(e) => setNewRating(Number(e.target.value))}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-bold text-amber-600"
                >
                  <option value="5">⭐⭐⭐⭐⭐ (5 - Exceptional)</option>
                  <option value="4">⭐⭐⭐⭐ (4 - Very Good)</option>
                  <option value="3">⭐⭐⭐ (3 - Average)</option>
                  <option value="2">⭐⭐ (2 - Poor)</option>
                  <option value="1">⭐ (1 - Terrible)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-600 mb-1">Review Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Peaceful stay, loved the balcony!"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-600 mb-1">Your Detailed Experience</label>
                <textarea
                  required
                  rows="4"
                  placeholder="Describe your stay, host communication, cleanliness, Wi-Fi speed..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2 rounded-xl shadow-sm"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
