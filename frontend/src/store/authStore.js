import { create } from 'zustand';
import { authService } from '../services/authService';

const readStoredJson = (key) => {
  try {
    if (typeof window === 'undefined') return null;
    const rawValue = localStorage.getItem(key);
    if (!rawValue || rawValue === 'undefined' || rawValue === 'null') {
      localStorage.removeItem(key);
      return null;
    }
    return JSON.parse(rawValue);
  } catch {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: readStoredJson('rms_user'),
  token: typeof window !== 'undefined' ? (localStorage.getItem('rms_token') || null) : null,
  refreshToken: typeof window !== 'undefined' ? (localStorage.getItem('rms_refresh_token') || null) : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('rms_token') : false,
  isLoading: false,

  setAuth: (user, token, refreshToken = null) => {
    localStorage.setItem('rms_token', token);
    localStorage.setItem('rms_user', JSON.stringify(user));
    if (refreshToken) localStorage.setItem('rms_refresh_token', refreshToken);
    set({ user, token, refreshToken: refreshToken || get().refreshToken, isAuthenticated: true });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authService.login(email, password);
      
      if (res.data && res.data.requires2FA) {
        set({ isLoading: false });
        return { success: true, requires2FA: true, tempToken: res.data.tempToken, message: res.message };
      }

      const { user, token, refreshToken } = res.data;
      get().setAuth(user, token, refreshToken);
      set({ isLoading: false });
      return { success: true, user };
    } catch (error) {
      set({ isLoading: false });
      const msg = error.response?.data?.error || 'Login failed. Please check credentials.';
      return { success: false, error: msg };
    }
  },

  verifyOtp: async (tempToken, otp) => {
    set({ isLoading: true });
    try {
      const res = await authService.verifyOtp(tempToken, otp);
      const { user, token, refreshToken } = res.data;
      get().setAuth(user, token, refreshToken);
      set({ isLoading: false });
      return { success: true, user };
    } catch (error) {
      set({ isLoading: false });
      const msg = error.response?.data?.error || 'Invalid OTP code.';
      return { success: false, error: msg };
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const res = await authService.register(data);
      set({ isLoading: false });
      return { success: true, data: res.data };
    } catch (error) {
      set({ isLoading: false });
      const msg = error.response?.data?.error || 'Registration failed.';
      return { success: false, error: msg };
    }
  },

  logout: () => {
    authService.logout().catch(() => {});
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_refresh_token');
    localStorage.removeItem('rms_user');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  updateUser: (updatedUser) => {
    localStorage.setItem('rms_user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('rms:token-refreshed', (event) => {
    useAuthStore.setState({ token: event.detail });
  });
}
