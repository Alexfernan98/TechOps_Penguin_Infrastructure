import api from './axios';

export const departmentsApi = {
  list:   ()           => api.get('/departments').then(r => r.data.departments),
  create: (body)       => api.post('/departments', body).then(r => r.data.department),
  update: (slug, body) => api.patch(`/departments/${slug}`, body).then(r => r.data.department),
  remove: (slug)       => api.delete(`/departments/${slug}`).then(r => r.data),
};

export const locationsApi = {
  list:   ()           => api.get('/locations').then(r => r.data.locations),
  create: (body)       => api.post('/locations', body).then(r => r.data.location),
  update: (slug, body) => api.patch(`/locations/${slug}`, body).then(r => r.data.location),
  remove: (slug)       => api.delete(`/locations/${slug}`).then(r => r.data),
};

export const categoriesApi = {
  list:    ()           => api.get('/asset-categories').then(r => r.data.categories),
  nextTag: (slug)       => api.get(`/asset-categories/${slug}/next-tag`).then(r => r.data.nextTag),
  create:  (body)       => api.post('/asset-categories', body).then(r => r.data.category),
  update:  (slug, body) => api.patch(`/asset-categories/${slug}`, body).then(r => r.data.category),
  remove:  (slug)       => api.delete(`/asset-categories/${slug}`).then(r => r.data),
};
