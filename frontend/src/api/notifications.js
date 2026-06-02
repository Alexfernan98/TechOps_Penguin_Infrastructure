import api from './axios';

export const notificationsApi = {
  list:    (params = {}) => api.get('/notifications', { params }).then(r => r.data),
  read:    (id)          => api.post(`/notifications/${id}/read`).then(r => r.data.notification),
  readAll: ()            => api.post('/notifications/read-all').then(r => r.data),
};
