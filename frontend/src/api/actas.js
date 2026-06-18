import api from './axios';

export const actasApi = {
  list:         (params = {}) => api.get('/actas', { params }).then(r => r.data.actas),
  get:          (id)          => api.get(`/actas/${id}`).then(r => r.data.acta),
  create:       (body)        => api.post('/actas', body).then(r => r.data.acta),
  createLegacy: (body)        => api.post('/actas/legacy', body).then(r => r.data.acta),
  previewUrl:   (id)          => `/actas/${id}/preview-html`,
  pdfUrl:       (id)          => `/actas/${id}/pdf`,
  uploadSigned: (id, formData) => api.post(`/actas/${id}/upload-signed`, formData).then(r => r.data.acta),
  remove:       (id)          => api.delete(`/actas/${id}`).then(r => r.data),
};
