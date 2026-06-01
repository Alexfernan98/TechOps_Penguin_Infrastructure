import { create } from 'zustand';
import api from '@/api/axios';

const useAuthStore = create((set) => ({
  user:      null,
  loading:   true,

  fetchUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null });
    window.location.href = '/login';
  },

  clearUser: () => set({ user: null, loading: false }),
}));

export default useAuthStore;
