import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaCheckCircle,
  FaShieldAlt,
  FaTag,
  FaCalendarAlt,
  FaUserFriends,
  FaLock,
  FaArrowRight,
} from 'react-icons/fa';
import { useBookingStore } from '../store/bookingStore';
import { useAuthStore } from '../store/authStore';
import { bookingService } from '../services/bookingService';
import { propertyService } from '../services/propertyService';
import { formatKES } from '../utils/currency';
import { getPendingBooking, consumePendingBooking } from '../utils/pendingBooking';
import toast from 'react-hot-toast';

export default function Booking() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { draftBooking, setDraftBooking } = useBookingStore();

  const savedDraft = getPendingBooking();
  const activeDraft = draftBooking?.property ? draftBooking : savedDraft || draftBooking;

  const [property, setProperty] = useState(activeDraft?.property || null);
  const [loading, setLoading] = useState(!activeDraft?.property);

  // Form State
  const [guestName, setGuestName] = useState(user?.firstName ? `${user.firstName} ${user.lastName}` : '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [guestPhone, setGuestPhone] = useState(user?.phone || '');
  const [arrivalWindow, setArrivalWindow] = useState('afternoon');
  const [specialRequests, setSpecialRequests] = useState('');
  const [addons, setAddons] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupDestination, setPickupDestination] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Promo Code State
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState('');

  // Payment Option: 100% full payment or 50% split deposit
  const [paymentOption, setPaymentOption] = useState('full'); // 'full' | 'deposit'
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (savedDraft && !draftBooking?.property) {
      const resolvedDraft = { ...savedDraft, property: savedDraft.property || null };
      setDraftBooking(resolvedDraft);
    }

    if (!activeDraft?.property && propertyId) {
      propertyService.getById(propertyId)
        .then((res) => {
          setProperty(res.data);
          if (activeDraft) {
            setDraftBooking({ ...activeDraft, property: res.data });
          }
        })
        .catch(() => {
          toast.error('Could not load property details');
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    if (activeDraft?.property && !property) {
      setProperty(activeDraft.property);
    }

    if (activeDraft && (!draftBooking?.checkInDate || !draftBooking?.checkOutDate)) {
      setDraftBooking(activeDraft);
    }

    if (activeDraft && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: { pathname: `/booking/${propertyId}` } } });
    }

    bookingService.getAddons().then((res) => setAddons(res.data || [])).catch(() => {});
  }, [activeDraft, draftBooking, isAuthenticated, navigate, property, propertyId, savedDraft, setDraftBooking]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <p className="font-bold text-neutral-600">Loading reservation summary...</p>
      </div>
    );
  }

  const checkIn = activeDraft?.checkInDate || '2026-09-05';
  const checkOut = activeDraft?.checkOutDate || '2026-09-08';
  const guests = activeDraft?.numberOfGuests || 2;
  const nights = activeDraft?.nights || 3;
  const ratePerNight = property?.pricePerNight || 5500;

  const rawSubtotal = ratePerNight * nights;
  const discountAmount = Math.round((rawSubtotal * discountPercent) / 100);
  const discountedSubtotal = rawSubtotal - discountAmount;
  const addonTotal = addons
    .filter((addon) => selectedAddonIds.includes(addon.id))
    .reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  const taxableSubtotal = discountedSubtotal + addonTotal;
  const vatTax = Math.round(taxableSubtotal * 0.16);
  const grandTotal = taxableSubtotal + vatTax;

  const dueNow = paymentOption === 'deposit' ? Math.round(grandTotal * 0.5) : grandTotal;
  const dueAtCheckIn = grandTotal - dueNow;

  const handleApplyPromo = (e) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (code === 'WELCOME10') {
      setDiscountPercent(10);
      setAppliedPromo(code);
      toast.success('🎉 10% First Booking discount applied!');
    } else if (code === 'SUMMER20') {
      setDiscountPercent(20);
      setAppliedPromo(code);
      toast.success('🎉 20% Vacation discount applied!');
    } else {
      toast.error('Invalid or expired promotional coupon code.');
    }
  };

  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error('Please accept the Terms of Service & Rental House Rules');
      return;
    }

    if (selectedAddonIds.includes('addon-airport') && (!pickupLocation || !pickupTime || !pickupDestination)) {
      toast.error('Pickup location, room destination, and pickup time are required for airport or room transfer.');
      setIsSubmitting(false);
      return;
    }

    const roomDropoffNote = pickupDestination ? `Room destination: ${pickupDestination}` : '';
    const fullPickupNotes = [pickupNotes, roomDropoffNote].filter(Boolean).join(' | ');

    setIsSubmitting(true);
    try {
      const res = await bookingService.create({
        propertyId: property?.id || propertyId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests: guests,
        totalAmount: grandTotal,
        discountCode: appliedPromo || null,
        discountAmount,
        specialRequests,
        arrivalWindow,
        addonIds: selectedAddonIds,
        pickupLocation,
        pickupDestination,
        pickupTime,
        pickupNotes: fullPickupNotes,
        source: 'website',
      });

      consumePendingBooking();

      const newBooking = res.data;
      toast.success('Booking draft created! Redirecting to payment...');
      navigate(`/payment/${newBooking.id}?amount=${dueNow}&total=${grandTotal}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initialize booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Confirm & Finalize Reservation</h1>
          <p className="text-sm text-neutral-500 mt-1">Review guest details, apply discounts, and select your payment plan.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Guest Info, Deposit Choice, Terms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Details Form */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-neutral-900 pb-3 border-b border-neutral-100">
                1. Guest Identification
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. David Kamau"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Email (for Tax Invoice)</label>
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="e.g. david@example.com"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Expected Arrival Window</label>
                  <select
                    value={arrivalWindow}
                    onChange={(e) => setArrivalWindow(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="morning">Morning (8 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                    <option value="evening">Evening (4 PM - 8 PM)</option>
                    <option value="late_night">Late night (after 8 PM)</option>
                  </select>
                  <p className="text-[11px] text-neutral-500 mt-1">Helps the property team prepare your arrival.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Phone Number (M-Pesa / SMS)</label>
                  <input
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="e.g. +254 712 345678"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Special Requests or Arrival Notes</label>
                  <textarea
                    rows="2"
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="e.g. Late check-in at 8 PM, extra towels, ground floor preference..."
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Split Deposit Payment Plan */}
            {addons.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                <h2 className="text-base font-extrabold text-neutral-900 pb-3 border-b border-neutral-100">
                  Optional Local Services
                </h2>
                <p className="text-xs text-neutral-500">Add practical services for a smoother stay. Prices are in KES and included in your booking total.</p>

                <button
                  type="button"
                  onClick={() => setSelectedAddonIds((current) => {
                    const hasAirportPickup = current.includes('addon-airport');
                    return hasAirportPickup
                      ? current.filter((id) => id !== 'addon-airport')
                      : [...current, 'addon-airport'];
                  })}
                  className={`w-full rounded-2xl border-2 p-3 text-left transition ${selectedAddonIds.includes('addon-airport') ? 'border-amber-500 bg-amber-50' : 'border-dashed border-neutral-300 bg-neutral-50 hover:border-amber-300'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-sm font-extrabold text-neutral-900">Need airport or room pickup?</span>
                      <span className="block text-[11px] text-neutral-500">We can arrange transfers from the airport, hotel, office, or direct delivery to your room.</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black ${selectedAddonIds.includes('addon-airport') ? 'bg-amber-500 text-white' : 'bg-white text-neutral-700 border border-neutral-200'}`}>
                      {selectedAddonIds.includes('addon-airport') ? 'Selected' : 'Add service'}
                    </span>
                  </div>
                </button>

                <p className="text-[11px] text-neutral-500 italic">
                  This service includes airport or room transfer coordination.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addons.map((addon) => {
                    const selected = selectedAddonIds.includes(addon.id);
                    return (
                      <button
                        type="button"
                        key={addon.id}
                        onClick={() => setSelectedAddonIds((current) => selected ? current.filter((id) => id !== addon.id) : [...current, addon.id])}
                        className={`text-left p-3 rounded-2xl border-2 transition ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-neutral-200 hover:border-emerald-300'}`}
                      >
                        <span className="font-bold text-xs text-neutral-900 block">{addon.name}</span>
                        <span className="text-[11px] text-neutral-500 block mt-1">{addon.description}</span>
                        <span className="text-xs font-black text-emerald-700 block mt-2">{formatKES(addon.price)}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedAddonIds.includes('addon-airport') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Pickup location</label>
                      <input required value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Airport, hotel, office, or landmark" className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Room / drop-off location *</label>
                      <input required value={pickupDestination} onChange={(e) => setPickupDestination(e.target.value)} placeholder="Property name, room number, or exact destination" className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Pickup date and time</label>
                      <input required type="datetime-local" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Pickup notes</label>
                      <input value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} placeholder="Flight number, luggage, room access, or meeting instructions" className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Split Deposit Payment Plan */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-neutral-900 pb-3 border-b border-neutral-100">
                2. Choose Payment Plan
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setPaymentOption('full')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                    paymentOption === 'full'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-sm'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-xs">Pay 100% in Full</span>
                    {paymentOption === 'full' && <FaCheckCircle className="text-amber-500" />}
                  </div>
                  <span className="text-lg font-black text-neutral-900 block">{formatKES(grandTotal)}</span>
                  <p className="text-[11px] text-neutral-500 mt-1">Complete payment now; zero balance on arrival.</p>
                </div>

                <div
                  onClick={() => setPaymentOption('deposit')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                    paymentOption === 'deposit'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-sm'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-xs">50% Deposit Now</span>
                    {paymentOption === 'deposit' && <FaCheckCircle className="text-amber-500" />}
                  </div>
                  <span className="text-lg font-black text-neutral-900 block">{formatKES(Math.round(grandTotal * 0.5))}</span>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Pay {formatKES(Math.round(grandTotal * 0.5))} today; remainder due upon check-in.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms and Cancellation Policy */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-neutral-900 pb-3 border-b border-neutral-100">
                3. Cancellation Policy & House Rules
              </h2>

              <p className="text-xs text-neutral-500 leading-relaxed">
                Free cancellation up to 48 hours prior to check-in. Non-refundable afterwards. Strict no-smoking policy indoors. Quiet hours observed after 10:00 PM.
              </p>

              <label className="flex items-start gap-3 text-xs font-semibold text-neutral-700 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-neutral-300 mt-0.5"
                />
                <span>I agree to the House Rules, Property Cancellation Policy, and RMS Terms of Service.</span>
              </label>
            </div>
          </div>

          {/* Right Column: Order Summary (in KES) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl border border-neutral-200 p-6 sticky top-24 space-y-6">
              <div className="flex gap-4 items-center pb-4 border-b border-neutral-100">
                <img
                  src={
                    (Array.isArray(property?.images) ? property.images[0] : property?.images) ||
                    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400'
                  }
                  alt={property?.name}
                  className="w-16 h-16 rounded-2xl object-cover"
                />
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{property?.type?.replace('_', ' ')}</span>
                  <h3 className="font-extrabold text-xs text-neutral-900 line-clamp-1">{property?.name}</h3>
                  <span className="text-xs font-bold text-amber-600">{formatKES(ratePerNight)}/night</span>
                </div>
              </div>

              {/* Dates & Guests */}
              <div className="space-y-2 text-xs text-neutral-600 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1"><FaCalendarAlt className="text-amber-500" /> Check-In:</span>
                  <span className="font-bold text-neutral-800">{checkIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1"><FaCalendarAlt className="text-amber-500" /> Check-Out:</span>
                  <span className="font-bold text-neutral-800">{checkOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1"><FaUserFriends className="text-amber-500" /> Guests:</span>
                  <span className="font-bold text-neutral-800">{guests} Guest(s)</span>
                </div>
              </div>

              {/* Coupon Form */}
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Promo code (e.g. WELCOME10)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-neutral-800 hover:bg-neutral-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
                >
                  Apply
                </button>
              </form>

              {appliedPromo && (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                  <FaTag /> Code {appliedPromo} applied ({discountPercent}% Off)
                </div>
              )}

              {/* Financial Calculation in KES */}
              <div className="space-y-2 text-xs text-neutral-600 border-t border-neutral-100 pt-4">
                <div className="flex justify-between">
                  <span>{formatKES(ratePerNight)} x {nights} nights</span>
                  <span>{formatKES(rawSubtotal)}</span>
                </div>

                {addonTotal > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Local services:</span>
                    <span>{formatKES(addonTotal)}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount ({discountPercent}%):</span>
                    <span>-{formatKES(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>16% VAT Tax:</span>
                  <span>{formatKES(vatTax)}</span>
                </div>

                <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-extrabold text-neutral-900">
                  <span>Total Cost:</span>
                  <span>{formatKES(grandTotal)}</span>
                </div>

                <div className="flex justify-between pt-1 font-black text-sm text-amber-600">
                  <span>Amount Due Now:</span>
                  <span>{formatKES(dueNow)}</span>
                </div>

                {dueAtCheckIn > 0 && (
                  <div className="flex justify-between text-[11px] text-neutral-400 font-semibold">
                    <span>Due at Check-in:</span>
                    <span>{formatKES(dueAtCheckIn)}</span>
                  </div>
                )}
              </div>

              {/* Proceed CTA */}
              <button
                onClick={handleProceedToPayment}
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-4 px-4 rounded-2xl shadow-md transition text-sm flex items-center justify-center gap-2"
              >
                <FaLock size={12} /> {isSubmitting ? 'Processing...' : `Pay ${formatKES(dueNow)} & Continue`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
