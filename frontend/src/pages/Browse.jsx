import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FaSearch,
  FaFilter,
  FaMapMarkerAlt,
  FaStar,
  FaHeart,
  FaRegHeart,
  FaExchangeAlt,
  FaTimes,
  FaSlidersH,
  FaCheck,
} from 'react-icons/fa';
import { propertyService } from '../services/propertyService';
import { useWishlistStore } from '../store/wishlistStore';
import { formatKES } from '../utils/currency';
import toast from 'react-hot-toast';

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('city') || '');
  const [selectedTypes, setSelectedTypes] = useState(
    searchParams.get('type') ? [searchParams.get('type')] : []
  );
  const [maxPrice, setMaxPrice] = useState(500000); // KES 500,000 max filter
  const [sortBy, setSortBy] = useState('price_asc');

  // Side-by-Side Comparison State (Up to 3 properties)
  const [comparedProperties, setComparedProperties] = useState([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const { isSaved, toggleWishlist, fetchWishlist } = useWishlistStore();

  useEffect(() => {
    fetchWishlist();
  }, []);

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      try {
        const res = await propertyService.getAll({
          search: search || undefined,
          type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
          limit: 30,
        });
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
        setProperties(list);
      } catch (err) {
        console.error('Failed to load listings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, [search, selectedTypes]);

  const propertyTypes = [
    { value: 'one_bedroom', label: 'One Bedroom' },
    { value: 'airbnb', label: 'Airbnb & Villa' },
    { value: 'single_room', label: 'Single Room' },
    { value: 'bedsitter', label: 'Bedsitter Studio' },
    { value: 'bnb', label: 'Bed & Breakfast' },
  ];

  const handleTypeToggle = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleToggleCompare = (property) => {
    if (comparedProperties.some((p) => p.id === property.id)) {
      setComparedProperties(comparedProperties.filter((p) => p.id !== property.id));
      toast.success(`Removed ${property.name} from comparison`);
    } else {
      if (comparedProperties.length >= 3) {
        toast.error('You can compare a maximum of 3 properties at a time.');
        return;
      }
      setComparedProperties([...comparedProperties, property]);
      toast.success(`Added ${property.name} to comparison!`);
    }
  };

  // Filter and Sort in Memory
  const filteredProperties = properties
    .filter((p) => {
      const price = parseFloat(p.pricePerNight || 0);
      const matchesPrice = price <= maxPrice;
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(p.type);
      return matchesPrice && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.pricePerNight - b.pricePerNight;
      if (sortBy === 'price_desc') return b.pricePerNight - a.pricePerNight;
      return 0;
    });

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Search Bar */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Explore Rental Stays in Kenya</h1>
            <p className="text-xs text-neutral-500">
              Showing {filteredProperties.length} available units matching your criteria
            </p>
          </div>

          <div className="w-full md:w-auto flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Search by neighborhood, city, or property name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <FaSearch className="absolute left-3.5 top-3.5 text-neutral-400 text-sm" />
          </div>
        </div>

        {/* Layout: Sidebar Filters + Property Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-2">
                  <FaSlidersH className="text-amber-500" /> Filter Listings
                </h3>
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setMaxPrice(500000);
                    setSearch('');
                  }}
                  className="text-xs font-bold text-amber-600 hover:underline"
                >
                  Reset
                </button>
              </div>

              {/* Property Types */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3">
                  Accommodation Type
                </label>
                <div className="space-y-2">
                  {propertyTypes.map((t) => (
                    <label
                      key={t.value}
                      className="flex items-center gap-3 text-xs font-semibold text-neutral-700 cursor-pointer hover:text-amber-600 transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(t.value)}
                        onChange={() => handleTypeToggle(t.value)}
                        className="w-4 h-4 text-amber-500 rounded border-neutral-300 focus:ring-amber-400"
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range Slider (in KES) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Max Price / Night
                  </label>
                  <span className="text-xs font-black text-amber-600">
                    {formatKES(maxPrice)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="500000"
                  step="500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-semibold">
                  <span>KES 1,000</span>
                  <span>KES 500,000+</span>
                </div>
              </div>

              {/* Sort By Dropdown */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Sort Order
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none"
                >
                  <option value="price_asc">Price: Lowest to Highest</option>
                  <option value="price_desc">Price: Highest to Lowest</option>
                </select>
              </div>
            </div>

            {/* Comparison Floating Bar Widget */}
            {comparedProperties.length > 0 && (
              <div className="bg-amber-500 text-white p-5 rounded-3xl shadow-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                    <FaExchangeAlt /> Side-by-Side Comparison
                  </span>
                  <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {comparedProperties.length}/3
                  </span>
                </div>
                <p className="text-xs opacity-90">
                  {comparedProperties.map((p) => p.name).join(', ')}
                </p>
                <button
                  onClick={() => setIsCompareModalOpen(true)}
                  className="w-full bg-white text-amber-800 font-extrabold text-xs py-2.5 rounded-xl shadow-md hover:bg-neutral-50 transition"
                >
                  Compare Now
                </button>
              </div>
            )}
          </aside>

          {/* Properties Grid */}
          <main className="lg:col-span-3">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-80 bg-neutral-200 rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-neutral-200 shadow-sm">
                <h3 className="text-lg font-bold text-neutral-800">No properties found</h3>
                <p className="text-xs text-neutral-500 mt-1 mb-6">
                  Try adjusting your price range, search query, or category filters.
                </p>
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setMaxPrice(500000);
                    setSearch('');
                  }}
                  className="bg-amber-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map((property) => {
                  const coverImg =
                    (Array.isArray(property.images)
                      ? property.images[0]
                      : typeof property.images === 'string'
                      ? property.images.split(',')[0]
                      : null) || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800';

                  const saved = isSaved(property.id);
                  const isCompared = comparedProperties.some((p) => p.id === property.id);

                  return (
                    <div
                      key={property.id}
                      className="bg-white rounded-3xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-xl transition flex flex-col group"
                    >
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={coverImg}
                          alt={property.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute top-3 left-3 bg-neutral-900/70 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                          {property.type?.replace('_', ' ')}
                        </div>

                        {/* Actions top right */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleCompare(property)}
                            title="Compare Property"
                            className={`w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center text-xs shadow-sm transition ${
                              isCompared
                                ? 'bg-amber-500 text-white'
                                : 'bg-white/80 text-neutral-700 hover:bg-white'
                            }`}
                          >
                            <FaExchangeAlt size={12} />
                          </button>

                          <button
                            onClick={() => toggleWishlist(property)}
                            title="Save to Wishlist"
                            className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-rose-500 hover:bg-white shadow-sm transition"
                          >
                            {saved ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
                            <span className="flex items-center gap-1 font-medium truncate">
                              <FaMapMarkerAlt className="text-amber-500" /> {property.city || property.address}
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 font-bold">
                              <FaStar size={10} /> {property.rating || '5.0'}
                            </span>
                          </div>

                          <h3 className="font-extrabold text-sm text-neutral-900 line-clamp-1 group-hover:text-amber-600 transition">
                            {property.name}
                          </h3>
                        </div>

                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                          <div>
                            <span className="text-base font-black text-neutral-900">{formatKES(property.pricePerNight)}</span>
                            <span className="text-[10px] text-neutral-400"> / night</span>
                            {(property.pricePerWeek || property.pricePerMonth) && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {property.pricePerWeek && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    Week {formatKES(property.pricePerWeek)}
                                  </span>
                                )}
                                {property.pricePerMonth && (
                                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-full">
                                    Month {formatKES(property.pricePerMonth)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <Link
                            to={`/property/${property.id}`}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal (Up to 3 properties) */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-neutral-100 mb-6">
              <h3 className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
                <FaExchangeAlt className="text-amber-500" /> Compare Accommodations
              </h3>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <FaTimes size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {comparedProperties.map((p) => {
                const img =
                  (Array.isArray(p.images)
                    ? p.images[0]
                    : typeof p.images === 'string'
                    ? p.images.split(',')[0]
                    : null) || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800';

                return (
                  <div key={p.id} className="border border-neutral-200 rounded-2xl p-4 space-y-4 bg-neutral-50/50">
                    <img src={img} alt={p.name} className="w-full h-36 object-cover rounded-xl" />
                    <h4 className="font-extrabold text-sm text-neutral-900">{p.name}</h4>

                    <div className="space-y-2 text-xs text-neutral-600 border-t border-neutral-200 pt-3">
                      <div className="flex justify-between">
                        <span className="font-medium text-neutral-400">Nightly Rate:</span>
                        <span className="font-black text-amber-600">{formatKES(p.pricePerNight)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-neutral-400">Type:</span>
                        <span className="font-bold capitalize">{p.type?.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-neutral-400">Location:</span>
                        <span className="font-bold">{p.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-neutral-400">Capacity:</span>
                        <span className="font-bold">{p.capacity || 2} Guests</span>
                      </div>
                    </div>

                    <Link
                      to={`/property/${p.id}`}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 rounded-xl text-center block shadow-sm transition"
                    >
                      Book This Unit
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
