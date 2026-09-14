import api from './api';

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
