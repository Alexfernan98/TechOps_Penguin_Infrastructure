import api from './axios';

export const usersApi = {
  list:       (params = {}) => api.get('/users', { params }).then(r => r.data.users),
  pick:       ()            => api.get('/users/pick').then(r => r.data.users),
  get:        (id)          => api.get(`/users/${id}`).then(r => r.data.user),
  update:     (id, body)    => api.patch(`/users/${id}`, body).then(r => r.data.user),
  activate:   (id)          => api.patch(`/users/${id}/activate`).then(r => r.data.user),
  deactivate: (id)          => api.patch(`/users/${id}/deactivate`).then(r => r.data.user),
  invite:     (body)        => api.post('/users/invite', body).then(r => r.data.user),
  import:     (rows)        => api.post('/users/import', { rows }).then(r => r.data),
};
