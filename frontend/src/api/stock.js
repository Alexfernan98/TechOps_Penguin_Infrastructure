import api from './axios';

export const stockApi = {
  list:     (params = {}) => api.get('/stock', { params }).then(r => r.data.items),
  get:      (id)          => api.get(`/stock/${id}`).then(r => r.data),
  create:   (body)        => api.post('/stock', body).then(r => r.data.item),
  update:   (id, body)    => api.patch(`/stock/${id}`, body).then(r => r.data.item),
  movement: (id, body)    => api.post(`/stock/${id}/movement`, body).then(r => r.data.item),
  deploy:   (id, body)    => api.post(`/stock/${id}/deploy`, body).then(r => r.data),
  remove:   (id)          => api.delete(`/stock/${id}`).then(r => r.data),
  import:   (rows, defaultGroupSlug) => api.post('/stock/import', { rows, defaultGroupSlug }).then(r => r.data),
  importTemplate: (filename, columns) => api.post('/stock/import-template', { filename, columns }, { responseType: 'blob' }).then(r => r.data),
  importFile: (file, columns, defaultGroupSlug) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('columns', JSON.stringify(columns));
    if (defaultGroupSlug) fd.append('defaultGroupSlug', defaultGroupSlug);
    return api.post('/stock/import-file', fd).then(r => r.data);
  },
};

export const stockGroupsApi = {
  list:   ()          => api.get('/stock-groups').then(r => r.data.groups),
  create: (body)      => api.post('/stock-groups', body).then(r => r.data.group),
  update: (slug, body) => api.patch(`/stock-groups/${slug}`, body).then(r => r.data.group),
  remove: (slug)      => api.delete(`/stock-groups/${slug}`).then(r => r.data),
};
