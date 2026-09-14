import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaSearch,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUserFriends,
  FaStar,
  FaHeart,
  FaRegHeart,
  FaShieldAlt,
  FaWifi,
  FaHeadset,
  FaTag,
} from 'react-icons/fa';
import { propertyService } from '../services/propertyService';
import { useWishlistStore } from '../store/wishlistStore';
import { formatKES } from '../utils/currency';

export default function Home() {
  const navigate = useNavigate();
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search widget state
  const [searchLocation, setSearchLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [guestCount, setGuestCount] = useState('1');

  const { isSaved, toggleWishlist, fetchWishlist } = useWishlistStore();

  useEffect(() => {
    fetchWishlist();
    async function loadFeatured() {
      try {
        const res = await propertyService.getAll({ limit: 6 });
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
        setFeaturedProperties(list);
      } catch (err) {
        console.error('Failed to load featured listings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchLocation.trim()) params.set('city', searchLocation.trim());
    if (propertyType) params.set('type', propertyType);
    if (guestCount) params.set('guests', guestCount);
    navigate(`/browse?${params.toString()}`);
  };

  const categories = [
    { type: 'one_bedroom', label: '1-Bedrooms', count: '18+ Stays', icon: '🏢' },
    { type: 'airbnb', label: 'Airbnb & Villas', count: '32+ Stays', icon: '🏖️' },
    { type: 'single_room', label: 'Single Rooms', count: '14+ Stays', icon: '🛏️' },
    { type: 'bedsitter', label: 'Bedsitters & Studios', count: '24+ Stays', icon: '🛋️' },
    { type: 'bnb', label: 'Bed & Breakfasts', count: '12+ Stays', icon: '🍳' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Hero Section with Natural Yellow Warm Accent */}
      <section className="relative bg-gradient-to-br from-amber-50 via-amber-100/40 to-neutral-50 pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-amber-200/50">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            <FaTag className="text-amber-600" /> Best Rental Rates in Kenya (KES)
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-neutral-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Find Your Dream <span className="text-amber-500 underline decoration-amber-300">Short & Long Term</span> Stays in Kenya
          </h1>

          <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto">
            Book verified 1-bedrooms, Airbnbs, luxury villas, bedsitters, and BnBs across Nairobi, Mombasa, Kisumu, Diani, and beyond.
          </p>

          {/* Interactive Floating Search Widget */}
          <div className="pt-6 max-w-5xl mx-auto">
            <form
              onSubmit={handleSearchSubmit}
              className="bg-white p-3 sm:p-4 rounded-3xl shadow-xl border border-neutral-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left"
            >
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-amber-400 transition">
                <label className="block text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5 mb-1">
                  <FaMapMarkerAlt className="text-amber-500" /> Location / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Westlands, Diani, Kilimani"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-neutral-800 placeholder-neutral-400 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-amber-400 transition">
                <label className="block text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5 mb-1">
                  <FaCalendarAlt className="text-amber-500" /> Stay Category
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-neutral-800 focus:outline-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  <option value="one_bedroom">One Bedroom</option>
                  <option value="airbnb">Airbnb & Villa</option>
                  <option value="single_room">Single Room</option>
                  <option value="bedsitter">Bedsitter / Studio</option>
                  <option value="bnb">Bed & Breakfast</option>
                </select>
              </div>

              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-amber-400 transition">
                <label className="block text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5 mb-1">
                  <FaUserFriends className="text-amber-500" /> Guests
                </label>
                <select
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-neutral-800 focus:outline-none cursor-pointer"
                >
                  <option value="1">1 Guest</option>
                  <option value="2">2 Guests</option>
                  <option value="3">3 Guests</option>
                  <option value="4">4+ Guests</option>
                </select>
              </div>

              <div className="flex items-center">
                <button
                  type="submit"
                  className="w-full h-full min-h-[52px] bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-base"
                >
                  <FaSearch /> Search Stays
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Category Shortcuts */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-neutral-900">Explore by Category</h2>
            <p className="text-xs text-neutral-500">Pick the perfect type of accommodation for your trip or residency</p>
          </div>
          <Link to="/browse" className="text-xs font-bold text-amber-600 hover:text-amber-700">
            View All &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.type}
              to={`/browse?type=${cat.type}`}
              className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 hover:shadow-lg transition flex flex-col items-center text-center group"
            >
              <span className="text-3xl mb-2 transform group-hover:scale-110 transition">{cat.icon}</span>
              <h3 className="font-bold text-sm text-neutral-900 group-hover:text-amber-600 transition">{cat.label}</h3>
              <span className="text-[11px] text-neutral-400 mt-0.5">{cat.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Properties Grid */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-neutral-900">Featured Accommodations</h2>
            <p className="text-xs text-neutral-500">Top-rated properties with verified host amenities and live instant booking</p>
          </div>
          <Link to="/browse" className="text-xs font-bold text-amber-600 hover:text-amber-700">
            See More Properties &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-neutral-200 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map((property) => {
              const coverImg =
                (Array.isArray(property.images)
                  ? property.images[0]
                  : typeof property.images === 'string'
                  ? property.images.split(',')[0]
                  : null) || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800';

              const saved = isSaved(property.id);

              return (
                <div
                  key={property.id}
                  className="bg-white rounded-3xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-xl transition flex flex-col group"
                >
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={coverImg}
                      alt={property.name}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800';
                        }}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-neutral-900/70 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase">
                      {property.type?.replace('_', ' ')}
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleWishlist(property);
                      }}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-rose-500 hover:bg-white shadow-sm transition"
                    >
                      {saved ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
                    </button>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                        <span className="flex items-center gap-1 font-medium">
                          <FaMapMarkerAlt className="text-amber-500" /> {property.city || property.address}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 font-bold">
                          <FaStar /> {property.rating || '5.0'}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base text-neutral-900 line-clamp-1 group-hover:text-amber-600 transition">
                        {property.name}
                      </h3>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-1">
                        {property.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <div>
                        <span className="text-lg font-black text-neutral-900">{formatKES(property.pricePerNight)}</span>
                        <span className="text-xs text-neutral-400 font-medium"> / night</span>
                      </div>

                      <Link
                        to={`/property/${property.id}`}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
                      >
                        View & Book
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Feature Value Props */}
      <section className="bg-white border-t border-neutral-200 py-16 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl shadow-sm">
              <FaShieldAlt />
            </div>
            <h3 className="font-bold text-base text-neutral-900">Secure M-Pesa & Card Checkout</h3>
            <p className="text-xs text-neutral-500">
              Pay easily via instant M-Pesa STK push (in KES), Credit/Debit Card, or PayPal (in USD) with 256-bit SSL encryption.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl shadow-sm">
              <FaWifi />
            </div>
            <h3 className="font-bold text-base text-neutral-900">Offline-Ready Sync Technology</h3>
            <p className="text-xs text-neutral-500">
              Reservations and availability stay synchronized seamlessly between physical front-desk POS and the online web app.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl shadow-sm">
              <FaHeadset />
            </div>
            <h3 className="font-bold text-base text-neutral-900">24/7 Concierge & Verified Hosts</h3>
            <p className="text-xs text-neutral-500">
              Every unit is physically inspected to ensure high cleanliness standards, fast Wi-Fi, and round-the-clock support.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
