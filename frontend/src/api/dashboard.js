import api from './axios';

export const dashboardApi = {
  get: () => api.get('/dashboard').then(r => r.data),
};
