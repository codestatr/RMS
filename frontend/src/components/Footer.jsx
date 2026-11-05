import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../contexts/BrandingContext';
import '../styles/marketplace.css';

export default function Footer() {
  const branding = useBranding();
  return (
    <footer className="market-footer">
      <div className="market-footer-main">
        <div className="market-footer-brand"><Link to="/" className="market-wordmark"><img src={branding.logo || '/rms-logo.svg'} alt="" /><span>{branding.brandName}<small>FIND YOUR PLACE</small></span></Link><p>Rooms, homes and weekend stays across Kenya.</p></div>
        <div className="market-footer-links"><span>Explore</span><Link to="/browse">Browse stays</Link><Link to="/dashboard?tab=bookings">Your bookings</Link><Link to="/dashboard?tab=wishlist">Saved stays</Link></div>
        <div className="market-footer-links"><span>For your next trip</span><p>Compare locations, nightly prices and property details before you book.</p><Link to="/browse" className="market-footer-cta">Search available stays <b aria-hidden="true">↗</b></Link></div>
      </div>
      <div className="market-footer-bottom">
        <span>© {new Date().getFullYear()} {branding.brandName}</span>
        <div className="market-footer-contact">
          {branding.phone && <a href={`tel:${branding.phone.replace(/[^+\d]/g, '')}`}>{branding.phone}</a>}
          {branding.phone && branding.email && <span aria-hidden="true">/</span>}
          {branding.email && <a href={`mailto:${branding.email}`}>{branding.email}</a>}
        </div>
        <span>Prices shown in KES where available</span>
      </div>
    </footer>
  );
}
