import api from './axios';

export const auditApi = {
  list: (params = {}) => api.get('/audit', { params }).then(r => r.data),
};
