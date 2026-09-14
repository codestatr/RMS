import api from './api';

export const bookingService = {
  async getAddons() {
    const res = await api.get('/bookings/addons');
    return res.data;
  },

  async create(data) {
    const res = await api.post('/bookings', data);
    return res.data;
  },

  async getMyBookings(status = null, page = 1, limit = 20) {
    const res = await api.get('/bookings', {
      params: { status, page, limit },
    });
    return res.data;
  },

  async getById(id) {
    const res = await api.get(`/bookings/${id}`);
    return res.data;
  },

  async cancel(id, reason = null) {
    const res = await api.post(`/bookings/${id}/cancel`, { reason });
    return res.data;
  },
};
