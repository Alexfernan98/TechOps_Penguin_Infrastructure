import api from './axios';

export const ticketsApi = {
  list:        (params = {}) => api.get('/tickets', { params }).then(r => r.data.tickets),
  get:         (id)          => api.get(`/tickets/${id}`).then(r => r.data),
  create:      (body)        => api.post('/tickets', body).then(r => r.data.ticket),
  update:      (id, body)    => api.patch(`/tickets/${id}`, body).then(r => r.data.ticket),
  changeStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }).then(r => r.data.ticket),
  assign:      (id, assignedToId) => api.patch(`/tickets/${id}/assign`, { assignedToId }).then(r => r.data.ticket),
  comment:     (id, body)    => api.post(`/tickets/${id}/comments`, body).then(r => r.data.comment),
  csat:        (id, body)    => api.post(`/tickets/${id}/csat`, body).then(r => r.data.csat),
};
