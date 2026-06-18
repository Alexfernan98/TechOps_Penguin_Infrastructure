import api from './axios';

export const driveApi = {
  // Lista archivos en la carpeta de Drive correspondiente al tipo de acta.
  // type ∈ DELIVERY | RETURN | RETIREMENT
  listActas: (type) => api.get('/drive/actas', { params: { type } }).then(r => r.data),
  config:    ()     => api.get('/drive/config').then(r => r.data),
};
