import { create } from 'zustand';
import axios from 'axios';
import { ORIGIN } from '@/api/axios';

// /auth/* está MONTADO FUERA del prefijo /api (por compat con la callback URL
// que Google Console tiene fija). Usamos axios global con ORIGIN explícito en
// vez del cliente `api` que prepende baseURL=ORIGIN/api.
const authClient = axios.create({
  baseURL: `${ORIGIN}/auth`,
  withCredentials: true,
});

const useAuthStore = create((set) => ({
  user:      null,
  loading:   true,

  fetchUser: async () => {
    try {
      const { data } = await authClient.get('/me');
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  logout: async () => {
    try {
      await authClient.post('/logout');
    } catch (e) {
      console.warn('Logout backend falló (limpio igual):', e?.response?.status, e?.message);
    }
    set({ user: null });
    window.location.replace('/login');
  },

  clearUser: () => set({ user: null, loading: false }),
}));

export default useAuthStore;
