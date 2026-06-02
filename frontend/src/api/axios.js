import axios from 'axios';

// El frontend habla al MISMO ORIGEN del browser por defecto: nginx (puerto 80)
// enruta /auth, /users, /assets, etc. al backend. Eso permite que cualquier
// equipo de la LAN acceda con su propia IP sin reconfigurar URLs.
// VITE_API_URL solo se usa si está explícitamente seteado (override en build).
export const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

// Helper para URLs que usan el navegador directo (window.open, iframe, <a download>).
export const apiUrl = (path) => `${API_BASE}${path}`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url      = original?.url || '';
    const status   = error.response?.status;

    // No reintentar sobre los propios endpoints de auth (rompe loops de refresh)
    const isAuthEndpoint = url.includes('/auth/refresh') || url.includes('/auth/me') || url.includes('/auth/logout');

    if (status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        return api(original);
      } catch {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
