import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/marketplace.css';

export default function Footer() {
  return (
    <footer className="market-footer">
      <div className="market-footer-main">
        <div className="market-footer-brand"><Link to="/" className="market-wordmark"><img src="/rms-logo.svg" alt="" /><span>CozyStay<small>FIND YOUR PLACE</small></span></Link><p>Rooms, homes and weekend stays across Kenya.</p></div>
        <div className="market-footer-links"><span>Explore</span><Link to="/browse">Browse stays</Link><Link to="/dashboard?tab=bookings">Your bookings</Link><Link to="/dashboard?tab=wishlist">Saved stays</Link></div>
        <div className="market-footer-links"><span>For your next trip</span><p>Compare locations, nightly prices and property details before you book.</p><Link to="/browse" className="market-footer-cta">Search available stays <b aria-hidden="true">↗</b></Link></div>
      </div>
      <div className="market-footer-bottom"><span>© {new Date().getFullYear()} CozyStay</span><span>Prices shown in KES where available</span></div>
    </footer>
  );
}
