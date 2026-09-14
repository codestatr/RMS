import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaSearch } from 'react-icons/fa';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] bg-neutral-50 flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-lg border border-neutral-200">
        <span className="text-6xl font-black text-amber-500 block mb-3">404</span>
        <h1 className="text-2xl font-extrabold text-neutral-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-neutral-500 mb-8">
          The property, page, or link you're looking for doesn't exist or has moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3 px-5 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            <FaHome /> Return Home
          </Link>
          <Link
            to="/browse"
            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs py-3 px-5 rounded-xl transition flex items-center justify-center gap-2"
          >
            <FaSearch /> Explore Stays
          </Link>
        </div>
      </div>
    </div>
  );
}
