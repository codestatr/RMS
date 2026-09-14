import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-100 mt-12">
      <div className="container-flex py-12">
        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/rms-logo.svg" alt="RMS Properties logo" className="h-10 w-10 rounded-xl object-cover border border-amber-500/40" />
              <h3 className="text-lg font-bold text-amber-400">RMS Properties</h3>
            </div>
            <p className="text-neutral-400 text-sm">
              Your trusted platform for booking rental properties online.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-primary-400 mb-4">Quick Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              <Link to="/" className="text-neutral-400 hover:text-primary-400 transition">Home</Link>
              <Link to="/browse" className="text-neutral-400 hover:text-primary-400 transition">Browse Properties</Link>
              <Link to="/dashboard" className="text-neutral-400 hover:text-primary-400 transition">My Bookings</Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-primary-400 mb-4">Support</h4>
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-neutral-500">Help Center</span>
              <a href="mailto:support@rms-system.com" className="text-neutral-400 hover:text-primary-400 transition-colors">Contact Us</a>
              <span className="text-neutral-500">FAQ</span>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-primary-400 mb-4">Legal</h4>
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-neutral-500">Privacy Policy</span>
              <span className="text-neutral-500">Terms of Service</span>
              <span className="text-neutral-500">Cookie Policy</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Copyright */}
            <p className="text-neutral-400 text-sm">
              &copy; 2026 RMS House Rental System. All rights reserved.
            </p>

            {/* Social Links */}
            <span className="text-neutral-500 text-sm">Social links pending</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
