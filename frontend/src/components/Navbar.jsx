import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaHeart, FaTimes, FaUser } from 'react-icons/fa';
import { useAuthStore } from '../store/authStore';
import { useWishlistStore } from '../store/wishlistStore';
import { useBranding } from '../contexts/BrandingContext';
import '../styles/marketplace.css';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { savedProperties, fetchWishlist } = useWishlistStore();
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { if (isAuthenticated) fetchWishlist(); }, [isAuthenticated, fetchWishlist]);
  useEffect(() => { setIsOpen(false); setUserDropdown(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const active = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <header className="market-nav-shell">
      <div className="market-nav">
        <Link to="/" className="market-wordmark" aria-label={`${branding.brandName} home`}><img src={branding.logo || '/rms-logo.svg'} alt="" /><span>{branding.brandName}<small>FIND YOUR PLACE</small></span></Link>
        <nav className="market-nav-links" aria-label="Main navigation">
          <Link className={active('/') ? 'is-active' : ''} to="/">Home</Link>
          <Link className={active('/browse') ? 'is-active' : ''} to="/browse">Find a stay</Link>
          {isAuthenticated && <Link className={active('/dashboard') ? 'is-active' : ''} to="/dashboard?tab=bookings">My bookings</Link>}
        </nav>
        <div className="market-nav-actions">
          {isAuthenticated ? (
            <div className="market-account-wrap">
              <button type="button" className="market-account-button" onClick={() => setUserDropdown(!userDropdown)} aria-expanded={userDropdown}>
                <span className="market-account-initial">{user?.firstName?.charAt(0)?.toUpperCase() || <FaUser />}</span><span>{user?.firstName || 'Account'}</span><span aria-hidden="true">⌄</span>
              </button>
              {userDropdown && <div className="market-account-menu">
                <p>Signed in as<br /><strong>{user?.email}</strong></p>
                <Link to="/dashboard">Account</Link><Link to="/dashboard?tab=bookings">My bookings</Link>
                <Link to="/dashboard?tab=wishlist"><FaHeart /> Saved stays ({savedProperties.length})</Link>
                <button type="button" onClick={handleLogout}>Sign out</button>
              </div>}
            </div>
          ) : <><Link className="market-signin" to="/login">Sign in</Link><Link className="market-register" to="/register">Create account <span aria-hidden="true">↗</span></Link></>}
        </div>
        <button className="market-menu-toggle" type="button" aria-label={isOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>{isOpen ? <FaTimes /> : <FaBars />}</button>
      </div>
      <div className="market-announcement" aria-label={`${branding.brandName} announcements`}>
        <p className="market-announcement-accessible">Find your next stay with {branding.brandName}. Browse trusted homes and book your stay with ease.</p>
        <div className="market-announcement-window" aria-hidden="true">
          <div className="market-announcement-track">
            {[0, 1].map((copy) => <span className="market-announcement-group" key={copy}>
              <span>Find your next stay with {branding.brandName}</span><i>✦</i>
              <span>Browse trusted homes and holiday stays</span><i>✦</i>
              <span>Your next place is just a search away</span><i>✦</i>
            </span>)}
          </div>
        </div>
      </div>
      {isOpen && <nav className="market-mobile-menu" aria-label="Mobile navigation">
        <Link to="/">Home</Link><Link to="/browse">Find a stay</Link>
        {isAuthenticated ? <><Link to="/dashboard">Account</Link><Link to="/dashboard?tab=bookings">My bookings</Link><Link to="/dashboard?tab=wishlist">Saved stays ({savedProperties.length})</Link><button type="button" onClick={handleLogout}>Sign out</button></> : <><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></>}
      </nav>}
    </header>
  );
}
