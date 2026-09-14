import api from './api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

function normalizeProperty(property) {
  if (!property) return property;
  return {
    ...property,
    images: Array.isArray(property.images)
      ? property.images.map((image) => normalizeImageUrl(typeof image === 'string' ? image : image?.image_url))
      : [],
  };
}

export const propertyService = {
  async getAll(params = {}) {
    const res = await api.get('/properties', { params });
    const payload = res.data?.data || {};
    const list = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];

    return {
      ...res.data,
      data: list.map(normalizeProperty),
    };
  },

  async getById(id) {
    const res = await api.get(`/properties/${id}`);
    const payload = res.data?.data;
    const property = Array.isArray(payload) ? payload[0] : payload?.data || payload;
    return { ...res.data, data: normalizeProperty(property) };
  },

  async checkAvailability(id, checkInDate, checkOutDate) {
    const res = await api.get(`/properties/${id}/availability`, {
      params: { checkInDate, checkOutDate },
    });
    return res.data;
  },
};
