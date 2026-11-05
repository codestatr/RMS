import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaSearch, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { propertyService } from '../services/propertyService';
import api from '../services/api';
import { useWishlistStore } from '../store/wishlistStore';
import { formatKES } from '../utils/currency';
import '../styles/marketplace.css';

function getCover(images) {
  if (Array.isArray(images)) return images.find((image) => typeof image === 'string' && image.trim()) || null;
  if (typeof images === 'string' && images.trim()) return images.split(/\|\||,/)[0].trim() || null;
  return null;
}

function getImages(images) {
  if (Array.isArray(images)) return images.filter((image) => typeof image === 'string' && image.trim());
  if (typeof images === 'string' && images.trim()) return images.split(/\|\||,/).map((image) => image.trim()).filter(Boolean);
  return [];
}

export default function Home() {
  const navigate = useNavigate();
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [campaignSlides, setCampaignSlides] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
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
        setFeaturedError(true);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  useEffect(() => {
    api.get('/settings/homepage-campaigns')
      .then((response) => {
        const campaigns = Array.isArray(response.data?.data) ? response.data.data.filter((campaign) => campaign.active !== false && campaign.image && campaign.title) : [];
        setCampaignSlides(campaigns);
        setActiveSlide(0);
      })
      .catch((err) => console.error('Failed to load homepage campaigns:', err))
      .finally(() => setCampaignsLoading(false));
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchLocation.trim()) params.set('city', searchLocation.trim());
    if (propertyType) params.set('type', propertyType);
    if (guestCount) params.set('guests', guestCount);
    navigate(`/browse?${params.toString()}`);
  };

  const categories = [
    { type: 'one_bedroom', label: 'One bedroom' },
    { type: 'two_bedroom', label: 'Two bedroom' },
    { type: 'airbnb', label: 'Villas & holiday homes' },
    { type: 'single_room', label: 'Single rooms' },
    { type: 'bedsitter', label: 'Bedsitters & studios' },
    { type: 'bnb', label: 'Bed & breakfast' },
  ];

  const visibleProperties = featuredProperties.slice(0, 3);
  const hasCampaigns = campaignSlides.length > 0;
  const slides = hasCampaigns
    ? campaignSlides.map((campaign) => ({ ...campaign, isCampaign: true }))
    : campaignsLoading ? [] : featuredProperties.flatMap((property) =>
      getImages(property.images).map((image, imageIndex) => ({ property, image, imageIndex, isCampaign: false }))
    );
  const currentSlide = slides[activeSlide];

  useEffect(() => {
    if (activeSlide >= slides.length) setActiveSlide(0);
  }, [activeSlide, slides.length]);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setActiveSlide((index) => (index + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const changeSlide = (direction) => {
    if (!slides.length) return;
    setActiveSlide((index) => (index + direction + slides.length) % slides.length);
  };

  return (
    <div className="market-home">
      <section className={`market-hero ${hasCampaigns ? 'market-hero-with-campaign' : ''}`}>
        <div className="market-hero-copy">
          <p className="market-eyebrow"><span /> {currentSlide?.isCampaign && currentSlide.eyebrow ? currentSlide.eyebrow : 'STAYS ACROSS KENYA, IN ONE PLACE'}</p>
          {currentSlide?.isCampaign ? (
            <>
              <h1>{currentSlide.title}</h1>
              {currentSlide.description && <p className="market-intro">{currentSlide.description}</p>}
              {currentSlide.ctaLabel && currentSlide.ctaUrl
                ? <Link to={currentSlide.ctaUrl} className="market-hero-cta">{currentSlide.ctaLabel}<span aria-hidden="true">&#8599;</span></Link>
                : <a href="#find-a-stay" className="market-hero-cta">Find your stay<span aria-hidden="true">&#8599;</span></a>}
            </>
          ) : (
            <>
              <h1>A place to land,<br /><em>wherever Kenya</em><br />takes you.</h1>
              <p className="market-intro">Find a room for the week, a home for the month, or a quiet weekend by the coast.</p>
              <a href="#find-a-stay" className="market-hero-cta">Find your next stay<span aria-hidden="true">&#8599;</span></a>
            </>
          )}
          <div className="market-hero-trust"><span aria-hidden="true">&#10022;</span><p><strong>Find a place that feels right.</strong><br />Explore stays from hosts across Kenya.</p></div>
        </div>
        <div className="market-hero-photo" aria-roledescription="carousel" aria-label="Featured property photos">
          {currentSlide ? (
            <>
              <img key={currentSlide.id || `${currentSlide.property?.id}-${currentSlide.imageIndex}`} className="market-carousel-image" src={currentSlide.image} alt={currentSlide.isCampaign ? currentSlide.title : `${currentSlide.property.name || 'Property'} photo ${currentSlide.imageIndex + 1}`} />
              <div className="market-carousel-controls">
                <span>{String(activeSlide + 1).padStart(2, '0')} <i>/</i> {String(slides.length).padStart(2, '0')}</span>
                {slides.length > 1 && <div>
                  <button type="button" onClick={() => changeSlide(-1)} aria-label="Previous property photo"><FaChevronLeft /></button>
                  <button type="button" onClick={() => changeSlide(1)} aria-label="Next property photo"><FaChevronRight /></button>
                </div>}
              </div>
              {!currentSlide.isCampaign && (
                <div className="market-photo-caption">
                  <span>{[currentSlide.property.city, currentSlide.property.address].filter(Boolean).join(' · ') || 'Location not provided'}</span>
                  <strong>{currentSlide.property.name || 'Property listing'}</strong>
                  <span>{formatKES(currentSlide.property.pricePerNight)} / night</span>
                  <Link to={`/property/${currentSlide.property.id}`}>View this stay <span aria-hidden="true">↗</span></Link>
                </div>
              )}
              {slides.length > 1 && <div className="market-carousel-dots" role="group" aria-label="Choose featured photo">
                {slides.map((slide, index) => <button key={slide.id || `${slide.property?.id}-${slide.imageIndex}`} type="button" className={index === activeSlide ? 'is-active' : ''} onClick={() => setActiveSlide(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === activeSlide ? 'true' : undefined} />)}
              </div>}
            </>
          ) : (
            <div className="market-photo-empty">{featuredError ? 'Featured stays could not load right now.' : loading || campaignsLoading ? 'Loading available property photos…' : 'Property photos will appear here when listings include images.'}</div>
          )}
        </div>
      </section>

      <section className="market-search-wrap" id="find-a-stay">
        <form className="market-search" onSubmit={handleSearchSubmit}>
          <label className="market-search-field market-location-field">
            <span>Where</span>
            <input type="text" placeholder="City or neighbourhood" value={searchLocation} onChange={(event) => setSearchLocation(event.target.value)} />
          </label>
          <label className="market-search-field">
            <span>Type of stay</span>
            <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
              <option value="">Any kind of stay</option>
              {categories.map((category) => <option key={category.type} value={category.type}>{category.label}</option>)}
            </select>
          </label>
          <label className="market-search-field market-guests-field">
            <span>Guests</span>
            <select value={guestCount} onChange={(event) => setGuestCount(event.target.value)}>
              <option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4+ guests</option>
            </select>
          </label>
          <button className="market-search-button" type="submit"><FaSearch aria-hidden="true" /><span>Search stays</span></button>
        </form>
      </section>

      <section className="market-categories" aria-labelledby="category-heading">
        <p className="market-section-kicker">Start with what you need</p>
        <div className="market-category-row">
          <h2 id="category-heading">A stay for<br />every kind of trip.</h2>
          <nav aria-label="Browse by accommodation type">
            {categories.map((category, index) => (
              <Link key={category.type} to={`/browse?type=${category.type}`}><span>0{index + 1}</span>{category.label}<b aria-hidden="true">↗</b></Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="market-featured" aria-labelledby="featured-heading">
        <div className="market-section-heading">
          <div><p className="market-section-kicker">A few places to begin</p><h2 id="featured-heading">Stays worth a closer look.</h2></div>
          <Link to="/browse" className="market-text-link">Browse all stays <span aria-hidden="true">↗</span></Link>
        </div>
        {loading ? (
          <p className="market-status" role="status">Finding available stays…</p>
        ) : visibleProperties.length ? (
          <div className="market-listings">
            {visibleProperties.map((property, index) => {
              const saved = isSaved(property.id);
              return (
                <article className={`market-listing market-listing-${index + 1}`} key={property.id}>
                  <Link className="market-listing-image" to={`/property/${property.id}`}>
                    {getCover(property.images)
                      ? <img src={getCover(property.images)} alt={property.name || 'Rental accommodation'} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.hidden = true; }} />
                      : <span className="market-image-empty">No property image</span>}
                    <span className="market-listing-number">0{index + 1}</span>
                  </Link>
                  <div className="market-listing-details">
                    <div className="market-listing-meta"><span>{property.city || property.address || 'Kenya'}</span>{property.type && <span>{property.type.replaceAll('_', ' ')}</span>}</div>
                    <h3><Link to={`/property/${property.id}`}>{property.name || 'Property name not provided'}</Link></h3>
                    <p>{property.description || 'The host has not added a description.'}</p>
                    <div className="market-listing-bottom">
                      <div><strong>{formatKES(property.pricePerNight)}</strong><span> / night</span></div>
                      <Link to={`/property/${property.id}`} className="market-book-link">View stay <span aria-hidden="true">↗</span></Link>
                    </div>
                    <button className={`market-save ${saved ? 'is-saved' : ''}`} type="button" aria-label={saved ? 'Remove from saved stays' : 'Save this stay'} onClick={() => toggleWishlist(property)}>
                      {saved ? <FaHeart /> : <FaRegHeart />}<span>{saved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="market-empty"><h3>New places are on their way.</h3><p>Try a search to see stays currently listed across Kenya.</p><Link to="/browse" className="market-book-link">Browse available stays <span aria-hidden="true">↗</span></Link></div>
        )}
      </section>

      <section className="market-note">
        <p className="market-section-kicker">Booking, made clear</p>
        <h2>Know the price.<br /><em>Choose your place.</em><br />Book at your pace.</h2>
        <p>Browse real listings, check nightly prices in Kenyan shillings, and review the details before you reserve.</p>
        <Link to="/browse" className="market-note-link">Explore available stays <span aria-hidden="true">↗</span></Link>
        <span className="market-note-mark" aria-hidden="true">CS</span>
      </section>
    </div>
  );
}
