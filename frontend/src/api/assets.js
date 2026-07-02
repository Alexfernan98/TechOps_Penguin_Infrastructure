import api from './axios';

export const assetsApi = {
  list:      (params = {}) => api.get('/assets', { params }).then(r => r.data),
  get:       (id)          => api.get(`/assets/${id}`).then(r => r.data),
  create:    (body)        => api.post('/assets', body).then(r => r.data.asset),
  update:    (id, body)    => api.patch(`/assets/${id}`, body).then(r => r.data.asset),
  changeStatus: (id, body) => api.patch(`/assets/${id}/status`, body).then(r => r.data.asset),
  assign:    (id, body)    => api.post(`/assets/${id}/assign`, body).then(r => r.data.asset),
  unassign:  (id, body)    => api.post(`/assets/${id}/unassign`, body).then(r => r.data.asset),
  retire:    (id, body)    => api.patch(`/assets/${id}/retire`, body).then(r => r.data.asset),
  restore:   (id, body)    => api.patch(`/assets/${id}/restore`, body).then(r => r.data.asset),
  nextTag:   (category)    => api.get('/assets/next-tag', { params: { category } }).then(r => r.data.nextTag),
  warrantyAlerts: ()       => api.get('/assets/warranty-alerts').then(r => r.data),
  import:    (rows, defaultCategorySlug) => api.post('/assets/import', { rows, defaultCategorySlug }).then(r => r.data),
  importTemplate: (filename, columns) => api.post('/assets/import-template', { filename, columns }, { responseType: 'blob' }).then(r => r.data),
  importFile: (file, columns, defaultCategorySlug) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('columns', JSON.stringify(columns));
    if (defaultCategorySlug) fd.append('defaultCategorySlug', defaultCategorySlug);
    // No seteamos Content-Type: el browser agrega el boundary del multipart solo.
    return api.post('/assets/import-file', fd).then(r => r.data);
  },
  exportUrl: (params = {}) => `/assets/export?${new URLSearchParams(params).toString()}`,
  remove:    (id, { cascade = false } = {}) =>
    api.delete(`/assets/${id}${cascade ? '?cascade=true' : ''}`).then(r => r.data),
  byBarcode: (code)        => api.get(`/assets/by-barcode/${encodeURIComponent(code)}`).then(r => r.data.asset),
};
