import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  FaMobileAlt,
  FaCreditCard,
  FaPaypal,
  FaCheckCircle,
  FaReceipt,
  FaLock,
  FaPrint,
  FaArrowRight,
  FaGlobe,
} from 'react-icons/fa';
import { bookingService } from '../services/bookingService';
import { paymentService } from '../services/paymentService';
import { useAuthStore } from '../store/authStore';
import { formatKES, formatUSD, kesToUsd, USD_EXCHANGE_RATE } from '../utils/currency';
import toast from 'react-hot-toast';

export default function Payment() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const initialAmountKES = parseFloat(searchParams.get('amount') || '5500');
  const totalAmountKES = parseFloat(searchParams.get('total') || initialAmountKES);

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('mpesa'); // 'mpesa' | 'card' | 'paypal'

  // M-Pesa State
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone || '0712345678');
  const [stkWaiting, setStkWaiting] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [stkSecondsRemaining, setStkSecondsRemaining] = useState(120);

  // Card State
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState(user?.firstName ? `${user.firstName} ${user.lastName}` : '');

  // Payment Result State
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function loadBooking() {
      try {
        const res = await bookingService.getById(bookingId);
        setBooking(res.data);
      } catch (err) {
        toast.error('Failed to load booking details');
      } finally {
        setLoading(false);
      }
    }
    if (bookingId) loadBooking();
  }, [bookingId]);

  useEffect(() => {
    if (!stkWaiting || !checkoutRequestId) return undefined;

    let elapsed = 0;
    const poll = async () => {
      try {
        const response = await paymentService.getMpesaStatus(checkoutRequestId);
        const status = response.data?.status;
        if (status === 'paid') {
          const receiptRes = await paymentService.getReceipt(response.data.id);
          setReceiptData(receiptRes.data);
          setStkWaiting(false);
          setPaymentSuccess(true);
          toast.success('Payment confirmed by M-Pesa! Your booking is now active.');
          return true;
        }
        if (status === 'failed') {
          setStkWaiting(false);
          toast.error('M-Pesa payment was not completed. Please try again.');
          return true;
        }
      } catch (error) {
        console.error('M-Pesa status check failed:', error);
      }
      return false;
    };

    const interval = setInterval(async () => {
      elapsed += 3;
      setStkSecondsRemaining(Math.max(0, 120 - elapsed));
      const finished = await poll();
      if (finished || elapsed >= 120) {
        clearInterval(interval);
        if (!finished) {
          setStkWaiting(false);
          toast.error('M-Pesa confirmation timed out. Check your M-Pesa messages before retrying.');
        }
      }
    }, 3000);

    poll();
    return () => clearInterval(interval);
  }, [stkWaiting, checkoutRequestId]);

  const handleStartMpesaPayment = async (e) => {
    e.preventDefault();
    if (!mpesaPhone.trim()) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setIsProcessing(true);
    try {
      const response = await paymentService.initiateMpesaStk({
        bookingId,
        amount: initialAmountKES,
        phone: mpesaPhone,
      });
      setCheckoutRequestId(response.data?.checkoutRequestId || '');
      setStkSecondsRemaining(120);
      setStkWaiting(true);
      toast.success(`STK Push sent to ${mpesaPhone}! Enter your M-Pesa PIN on your phone.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to start M-Pesa payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecutePayment = async (method, ref) => {
    setIsProcessing(true);
    setStkWaiting(false);
    try {
      const paymentRes = await paymentService.create({
        bookingId,
        amount: initialAmountKES,
        method: method || paymentMethod,
        transactionRef: ref || `TX_${Date.now()}`,
      });

      const payment = paymentRes.data;

      // Fetch official receipt
      const receiptRes = await paymentService.getReceipt(payment.id);
      setReceiptData(receiptRes.data);
      setPaymentSuccess(true);
      toast.success('🎉 Payment confirmed! Your booking is now active.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardPayment = (e) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvv) {
      toast.error('Please enter all card details');
      return;
    }
    handleExecutePayment('card', `CARD_${Date.now().toString().slice(-8)}`);
  };

  const handlePayPalPayment = () => {
    handleExecutePayment('paypal', `PAYPAL_${Date.now().toString().slice(-8)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <p className="font-bold text-neutral-600">Loading payment gateway...</p>
      </div>
    );
  }

  // Success / Receipt Screen
  if (paymentSuccess && receiptData) {
    const isPaypalReceipt = receiptData.billing.paymentMethod === 'paypal';

    return (
      <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl border border-neutral-200 p-8 sm:p-10">
          <div className="text-center space-y-3 pb-6 border-b border-neutral-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
              <FaCheckCircle />
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Payment Successful!</h1>
            <p className="text-sm text-neutral-500">
              Your booking for <strong>{receiptData.property.name}</strong> is confirmed.
            </p>
          </div>

          {/* Printable Official Receipt */}
          <div className="my-8 bg-neutral-50 p-6 rounded-2xl border border-neutral-200 text-xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
              <div>
                <span className="font-bold text-neutral-900 text-sm block">Official Tax Receipt</span>
                <span className="text-neutral-500">{receiptData.receiptNumber}</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase text-[10px]">
                Paid & Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-neutral-400 block font-medium">Guest Name</span>
                <span className="font-bold text-neutral-800">{receiptData.customer.name}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Payment Method</span>
                <span className="font-bold text-neutral-800 uppercase">
                  {receiptData.billing.paymentMethod} {isPaypalReceipt ? '(USD)' : '(KES)'}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Stay Dates</span>
                <span className="font-bold text-neutral-800">
                  {receiptData.stay.checkInDate} to {receiptData.stay.checkOutDate}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Transaction Ref</span>
                <span className="font-mono text-neutral-800 font-semibold">{receiptData.billing.transactionRef}</span>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-3 space-y-1.5">
              <div className="flex justify-between">
                <span>Subtotal (Net):</span>
                <span className="font-semibold">{formatKES(receiptData.billing.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT ({receiptData.billing.taxRate}):</span>
                <span className="font-semibold">{formatKES(receiptData.billing.taxAmount)}</span>
              </div>

              {isPaypalReceipt ? (
                <div className="flex justify-between pt-2 border-t border-neutral-200 font-bold text-sm text-neutral-900">
                  <span>Amount Paid via PayPal:</span>
                  <span className="text-sky-600 font-mono">
                    {formatUSD(receiptData.billing.amountPaid)} ({formatKES(receiptData.billing.amountPaid)})
                  </span>
                </div>
              ) : (
                <div className="flex justify-between pt-2 border-t border-neutral-200 font-bold text-sm text-neutral-900">
                  <span>Amount Paid Today:</span>
                  <span className="text-amber-600 font-mono">{formatKES(receiptData.billing.amountPaid)}</span>
                </div>
              )}

              {receiptData.billing.balanceRemaining > 0 && (
                <div className="flex justify-between text-rose-600 font-bold pt-1">
                  <span>Balance Due at Check-In:</span>
                  <span>{formatKES(receiptData.billing.balanceRemaining)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => window.print()}
              className="flex-1 bg-neutral-800 hover:bg-neutral-900 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition"
            >
              <FaPrint /> Print / Save PDF
            </button>
            <Link
              to="/dashboard?tab=bookings"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition text-center"
            >
              Go to My Bookings <FaArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Select Payment Gateway</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Choose your preferred secure payment method to finalize booking <strong>#{bookingId?.slice(0, 8)}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Payment Method Selection & Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method Tabs */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 font-bold text-xs transition ${
                  paymentMethod === 'mpesa'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <FaMobileAlt size={22} className="text-emerald-600" />
                <span>M-Pesa (KES)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 font-bold text-xs transition ${
                  paymentMethod === 'card'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <FaCreditCard size={22} className="text-amber-500" />
                <span>Card (Visa/MC)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 font-bold text-xs transition ${
                  paymentMethod === 'paypal'
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <FaPaypal size={22} className="text-sky-600" />
                <span>PayPal (USD)</span>
              </button>
            </div>

            {/* M-Pesa Interactive Form (in KES) */}
            {paymentMethod === 'mpesa' && (
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    M
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">M-Pesa Online STK Express</h3>
                    <p className="text-xs text-neutral-500">Instant mobile money push prompt in Kenyan Shillings</p>
                  </div>
                </div>

                {stkWaiting ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900">PIN Prompt Sent to {mpesaPhone}</h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Please check your phone screen and enter your M-Pesa PIN...
                      </p>
                      <span className="inline-block mt-3 text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full">
                        Waiting for verified M-Pesa confirmation ({stkSecondsRemaining}s)
                      </span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleStartMpesaPayment} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">M-Pesa Mobile Number</label>
                      <input
                        type="tel"
                        required
                        placeholder="0712345678"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                    >
                      <FaLock size={12} /> Pay {formatKES(initialAmountKES)} with M-Pesa
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Credit / Debit Card Form (in KES) */}
            {paymentMethod === 'card' && (
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
                  <FaCreditCard className="text-amber-500 text-2xl" />
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">Credit / Debit Card (KES / Multi-Currency)</h3>
                    <p className="text-xs text-neutral-500">256-bit SSL encrypted card transaction in Kenyan Shillings</p>
                  </div>
                </div>

                <form onSubmit={handleCardPayment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Cardholder Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. David Kamau"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Card Number</label>
                    <input
                      type="text"
                      required
                      maxLength="19"
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-sm font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Expiry Date</label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        maxLength="5"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-sm font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">CVV / CVC</label>
                      <input
                        type="password"
                        required
                        maxLength="4"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-sm font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                  >
                    <FaLock size={12} /> {isProcessing ? 'Processing...' : `Pay ${formatKES(initialAmountKES)} with Card`}
                  </button>
                </form>
              </div>
            )}

            {/* PayPal International Checkout (in USD with conversion) */}
            {paymentMethod === 'paypal' && (
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5 text-center">
                <div className="flex items-center justify-center gap-2 text-sky-600">
                  <FaPaypal className="text-4xl" />
                  <FaGlobe className="text-2xl text-neutral-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-900">PayPal International Checkout (USD)</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Pay securely using your PayPal wallet or international credit/debit card.
                  </p>
                </div>

                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-xs space-y-1">
                  <div className="flex justify-between text-neutral-600">
                    <span>Stay Bill (KES):</span>
                    <span className="font-semibold">{formatKES(initialAmountKES)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Exchange Rate:</span>
                    <span className="font-mono">1 USD ≈ {USD_EXCHANGE_RATE} KES</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-sky-900 pt-2 border-t border-sky-200">
                    <span>PayPal Total:</span>
                    <span className="font-mono">{formatUSD(initialAmountKES)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePayPalPayment}
                  disabled={isProcessing}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition text-sm"
                >
                  {isProcessing ? 'Connecting...' : `Continue with PayPal (${formatUSD(initialAmountKES)})`}
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Order Payment Summary (in KES) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 sticky top-24 space-y-6">
              <h3 className="font-extrabold text-neutral-900 text-base border-b border-neutral-100 pb-3 flex items-center gap-2">
                <FaReceipt className="text-amber-500" /> Payment Summary
              </h3>

              <div className="space-y-2 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Booking Ref:</span>
                  <span className="font-mono font-bold text-neutral-900">#{bookingId?.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Property:</span>
                  <span className="font-bold text-neutral-900 line-clamp-1">{booking?.propertyName || 'Rental Unit'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Check-In:</span>
                  <span className="font-semibold text-neutral-800">{booking?.checkInDate || '2026-09-05'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Check-Out:</span>
                  <span className="font-semibold text-neutral-800">{booking?.checkOutDate || '2026-09-08'}</span>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4 space-y-2 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Total Stay Price:</span>
                  <span className="font-semibold text-neutral-800">{formatKES(totalAmountKES)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-extrabold text-neutral-900">
                  <span>Amount Due Now:</span>
                  <span className="text-amber-600">{formatKES(initialAmountKES)}</span>
                </div>
                {paymentMethod === 'paypal' && (
                  <div className="flex justify-between text-[11px] text-sky-700 font-bold">
                    <span>USD Equivalent:</span>
                    <span>{formatUSD(initialAmountKES)}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-tight">
                🔒 Protected by 256-bit SSL Security and Fraud Detection.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
