import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for attaching JWT auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = localStorage.getItem('rms_refresh_token');

    if (error.response?.status === 401 && refreshToken && !originalRequest?._retry && !originalRequest?.url?.includes('/auth/refresh')) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = refreshResponse.data?.data?.token;
        if (!newToken) throw new Error('Refresh response did not include a token');
        localStorage.setItem('rms_token', newToken);
        window.dispatchEvent(new CustomEvent('rms:token-refreshed', { detail: newToken }));
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('rms_token');
        localStorage.removeItem('rms_refresh_token');
        localStorage.removeItem('rms_user');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
