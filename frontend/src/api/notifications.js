import api from './axios';

export const notificationsApi = {
  list:        (params = {}) => api.get('/notifications', { params }).then(r => r.data),
  read:        (id)          => api.patch(`/notifications/${id}/read`).then(r => r.data.notification),
  readAll:     ()            => api.patch('/notifications/read-all').then(r => r.data),
  getPrefs:    ()            => api.get('/notifications/preferences').then(r => r.data.preferences),
  updatePrefs: (prefs)       => api.patch('/notifications/preferences', prefs).then(r => r.data.preferences),
};
