import api from './api';

export const reviewService = {
  async getByProperty(propertyId, page = 1, limit = 20) {
    const res = await api.get(`/reviews/property/${propertyId}`, {
      params: { page, limit },
    });
    return res.data;
  },

  async create(data) {
    const res = await api.post('/reviews', data);
    return res.data;
  },
};

export const wishlistService = {
  async getMyWishlist() {
    const res = await api.get('/wishlist');
    return res.data;
  },

  async toggle(propertyId) {
    const res = await api.post('/wishlist/toggle', { propertyId });
    return res.data;
  },
};
