import axios from 'axios';

const api = axios.create({
  baseURL: '/',
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
        await axios.post('/auth/refresh', {}, { withCredentials: true });
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
