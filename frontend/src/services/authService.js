import api from './api';

export const authService = {
  async register(data) {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  async login(email, password) {
    const res = await api.post('/auth/login', { email, password, client: 'web' });
    return res.data;
  },

  async refresh(refreshToken) {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data;
  },

  async logout() {
    const res = await api.post('/auth/logout');
    return res.data;
  },

  async verifyOtp(tempToken, otp) {
    const res = await api.post('/auth/verify-otp', { tempToken, otp });
    return res.data;
  },

  async getMe() {
    const res = await api.get('/users/me');
    return res.data;
  },

  async updateProfile(data) {
    const res = await api.put('/users/me', data);
    return res.data;
  },

  async uploadProfilePhoto(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async changePassword(currentPassword, newPassword) {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    return res.data;
  },

  async verifyToken(token) {
    const res = await api.post('/auth/verify', { token });
    return res.data;
  },
};
