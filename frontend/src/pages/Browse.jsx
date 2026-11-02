import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FaSearch,
  FaMapMarkerAlt,
  FaStar,
  FaHeart,
  FaRegHeart,
  FaExchangeAlt,
  FaTimes,
  FaSlidersH,
} from 'react-icons/fa';
import { propertyService } from '../services/propertyService';
import { useWishlistStore } from '../store/wishlistStore';
import { formatKES } from '../utils/currency';
import toast from 'react-hot-toast';
import '../styles/marketplace.css';

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('city') || '');
  const [selectedTypes, setSelectedTypes] = useState(
    searchParams.get('type') ? [searchParams.get('type')] : []
  );
  const [maxPrice, setMaxPrice] = useState(0); // 0 means no price ceiling
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

  const maxAvailablePrice = Math.max(1000, ...properties.map((property) => Number(property.pricePerNight || 0)));

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
      const matchesPrice = maxPrice === 0 || price <= maxPrice;
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
    <div className="market-browse">
      <div className="market-browse-inner">
        {/* Header & Search Bar */}
        <div className="browse-heading">
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
              className="browse-search-input"
            />
            <FaSearch className="browse-search-icon" />
          </div>
        </div>

        {/* Layout: Sidebar Filters + Property Grid */}
        <div className="browse-layout">
          {/* Sidebar Filters */}
          <aside className="browse-filters">
            <div className="browse-filter-sheet">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
                <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-2">
                  <FaSlidersH className="text-amber-500" /> Filter Listings
                </h3>
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setMaxPrice(0);
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
                    {maxPrice === 0 ? 'Any price' : formatKES(maxPrice)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={maxAvailablePrice}
                  step={Math.max(100, Math.round(maxAvailablePrice / 1000))}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-semibold">
                  <span>Any price</span>
                  <span>{formatKES(maxAvailablePrice)}</span>
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
            <div className="browse-compare-bar">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                    <FaExchangeAlt /> Side-by-Side Comparison
                  </span>
                  <span className="browse-count">
                    {comparedProperties.length}/3
                  </span>
                </div>
                <p className="text-xs opacity-90">
                  {comparedProperties.map((p) => p.name).join(', ')}
                </p>
                <button
                  onClick={() => setIsCompareModalOpen(true)}
                  className="browse-compare-button"
                >
                  Compare Now
                </button>
              </div>
            )}
          </aside>

          {/* Properties Grid */}
          <main className="browse-results">
            {loading ? (
              <div className="browse-skeleton-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="browse-skeleton" />
                ))}
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="browse-empty">
                <h3 className="text-lg font-bold text-neutral-800">No properties found</h3>
                <p className="text-xs text-neutral-500 mt-1 mb-6">
                  Try adjusting your price range, search query, or category filters.
                </p>
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setMaxPrice(0);
                    setSearch('');
                  }}
                  className="browse-clear-button"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="browse-property-grid">
                {filteredProperties.map((property) => {
                  const coverImg =
                    (Array.isArray(property.images)
                      ? property.images[0]
                      : typeof property.images === 'string'
                      ? property.images.split(',')[0]
                      : null) || null;

                  const saved = isSaved(property.id);
                  const isCompared = comparedProperties.some((p) => p.id === property.id);

                  return (
                    <article
                      key={property.id}
                      className="browse-property group"
                    >
                      <div className="browse-property-photo">
                        {coverImg ? <img src={coverImg} alt={property.name} onError={(event) => { event.currentTarget.hidden = true; }} className="browse-property-image" /> : <span className="browse-no-image">No property image</span>}
                        <div className="browse-type-label">
                          {property.type?.replace('_', ' ')}
                        </div>

                        {/* Actions top right */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleCompare(property)}
                            title="Compare Property"
                            aria-label={isCompared ? 'Remove from comparison' : 'Compare property'}
                            className={`browse-image-action ${
                              isCompared
                                ? 'is-selected'
                                : ''
                            }`}
                          >
                            <FaExchangeAlt size={12} />
                          </button>

                          <button
                            onClick={() => toggleWishlist(property)}
                            title="Save to Wishlist"
                            aria-label={saved ? 'Remove from saved stays' : 'Save this stay'}
                            className={`browse-image-action browse-save-action ${saved ? 'is-saved' : ''}`}
                          >
                            {saved ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="browse-property-copy">
                        <div>
                          <div className="browse-property-meta">
                            <span className="browse-location">
                              <FaMapMarkerAlt aria-hidden="true" /> {property.city || property.address || 'Kenya'}
                            </span>
                            <span className="browse-rating">
                              {property.rating ? <><FaStar size={10} /> {property.rating}</> : <span className="browse-no-rating">No reviews</span>}
                            </span>
                          </div>

                          <h3 className="browse-property-title">
                            {property.name}
                          </h3>
                        </div>

                        <div className="browse-property-footer">
                          <div>
                            <span className="text-base font-black text-neutral-900">{formatKES(property.pricePerNight)}</span>
                            <span className="text-[10px] text-neutral-400"> / night</span>
                            {(property.pricePerWeek || property.pricePerMonth) && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {property.pricePerWeek && (
                                    <span className="browse-rate-note">
                                    Week {formatKES(property.pricePerWeek)}
                                  </span>
                                )}
                                {property.pricePerMonth && (
                                    <span className="browse-rate-note">
                                    Month {formatKES(property.pricePerMonth)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <Link
                            to={`/property/${property.id}`}
                            className="browse-view-link"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal (Up to 3 properties) */}
      {isCompareModalOpen && (
        <div className="browse-modal-backdrop">
          <div className="browse-modal">
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
                    : null) || null;

                return (
                  <div key={p.id} className="border border-neutral-200 rounded-2xl p-4 space-y-4 bg-neutral-50/50">
                    {img ? <img src={img} alt={p.name} className="w-full h-36 object-cover rounded-xl" /> : <div className="browse-no-image browse-compare-no-image">No property image</div>}
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
                        <span className="font-bold">{p.capacity ? `${p.capacity} Guests` : 'Not provided'}</span>
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
