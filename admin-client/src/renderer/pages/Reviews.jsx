import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FaStar,
  FaCheck,
  FaTimes,
  FaCommentAlt,
  FaSearch,
  FaFilter,
} from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('rms_admin_token') || ''}`,
    },
  };
}

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    async function loadReviews() {
      try {
        const response = await axios.get(`${API_URL}/reviews?limit=100`, authConfig());
        setReviews(response.data?.data || []);
      } catch (error) {
        console.error('Failed to load reviews:', error);
      } finally {
        setLoading(false);
      }
    }

    loadReviews();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const response = await axios.patch(
        `${API_URL}/reviews/${id}/moderate`,
        { status: newStatus },
        authConfig()
      );
      setReviews((prev) => prev.map((review) => (review.id === id ? response.data?.data : review)));
    } catch (error) {
      console.error('Failed to moderate review:', error);
    }
  };

  const filtered = reviews.filter((r) => filterStatus === 'all' || r.status === filterStatus);

  const avgRating = (reviews.reduce((acc, r) => acc + r.rating, 0) / (reviews.length || 1)).toFixed(1);

  if (loading) {
    return <div className="loading-spinner">Loading reviews...</div>;
  }

  return (
    <div className="reviews-page space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
            <FaStar className="text-amber-500" /> Guest Ratings &amp; Reviews Moderation
          </h2>
          <p className="text-xs text-neutral-500">
            Moderate customer feedback and monitor property reputation scores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800"
          >
            <option value="all">All Reviews</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Moderation</option>
          </select>
        </div>
      </div>

      {/* Ratings Summary Card */}
      <div className="admin-card grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
        <div className="text-center sm:text-left">
          <span className="text-3xl font-black text-neutral-900 block">{avgRating} / 5.0</span>
          <div className="flex justify-center sm:justify-start text-amber-500 text-sm mt-1">
            {[...Array(5)].map((_, i) => (
              <FaStar key={i} />
            ))}
          </div>
          <span className="text-xs text-neutral-400 mt-1 block">Based on {reviews.length} guest reviews</span>
        </div>

        <div className="sm:col-span-2 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-12 font-bold text-neutral-600">5 Star</span>
            <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
              <div className="bg-amber-500 h-2 rounded-full w-[75%]"></div>
            </div>
            <span className="w-8 text-neutral-400 font-semibold">75%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-12 font-bold text-neutral-600">4 Star</span>
            <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
              <div className="bg-amber-500 h-2 rounded-full w-[25%]"></div>
            </div>
            <span className="w-8 text-neutral-400 font-semibold">25%</span>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Property Unit</th>
              <th>Rating</th>
              <th>Review Title &amp; Feedback</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rev) => (
              <tr key={rev.id}>
                <td className="font-bold text-neutral-900">{rev.customerName}</td>
                <td className="text-neutral-700 font-medium">{rev.propertyName}</td>
                <td>
                  <div className="flex text-amber-500 text-xs">
                    {[...Array(rev.rating)].map((_, i) => (
                      <FaStar key={i} />
                    ))}
                  </div>
                </td>
                <td className="max-w-md">
                  <span className="font-bold text-neutral-900 block">{rev.title}</span>
                  <span className="text-xs text-neutral-600 line-clamp-2">{rev.comment}</span>
                </td>
                <td>
                  <span className={rev.status === 'approved' ? 'badge-confirmed' : 'badge-pending'}>
                          {rev.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    {rev.status !== 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(rev.id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                      >
                        <FaCheck size={10} /> Approve
                      </button>
                    )}
                    {rev.status === 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(rev.id, 'pending')}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[11px] px-2.5 py-1 rounded-lg"
                      >
                        Hide
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
