// Mapa de campos visibles del formulario "Nuevo activo" / "Editar activo"
// por slug de categoría. Si la categoría no está en el mapa, se muestran TODOS
// los campos (fallback seguro para categorías nuevas).
//
// Campos posibles:
//   IT base:       brand, model, serialNumber, operatingSystem, macWifi, macEth, imei
//   Networking:    ipManagement, ports, role, haMode, displayLocation
//   CCTV / DC:     internalCode, cameraType, megapixels, nvrChannel
//
// Categorías:
//   IT:            desktop, notebook, monitor, printer, tv, mouse, mousepad, keyboard, stand, phone, tablet
//   Networking:    switch, firewall, ap
//   CCTV:          camera
//   Servidores/DC: server, ups, rack

const ALL = [
  'brand', 'model', 'serialNumber', 'operatingSystem', 'macWifi', 'macEth', 'imei',
  'ipManagement', 'internalCode', 'nvrChannel', 'cameraType', 'megapixels',
  'ports', 'role', 'haMode', 'haPeerAssetId', 'displayLocation',
];

const MAP = {
  // ── IT ──────────────────────────────────────────────────────────────────
  desktop:  ['brand', 'model', 'serialNumber', 'operatingSystem', 'macWifi', 'macEth'],
  notebook: ['brand', 'model', 'serialNumber', 'operatingSystem', 'macWifi', 'macEth'],
  monitor:  ['brand', 'model', 'serialNumber'],
  printer:  ['brand', 'model', 'serialNumber', 'ipManagement', 'macWifi', 'macEth'],
  tv:       ['brand', 'model', 'serialNumber', 'macWifi'],
  phone:    ['brand', 'model', 'serialNumber', 'imei', 'operatingSystem'],
  tablet:   ['brand', 'model', 'serialNumber', 'imei', 'operatingSystem', 'macWifi'],
  mouse:    ['brand', 'model'],
  keyboard: ['brand', 'model'],
  stand:    ['brand', 'model'],
  mousepad: ['brand'],
  // ── Networking ──────────────────────────────────────────────────────────
  switch:   ['brand', 'model', 'serialNumber', 'ipManagement', 'macEth', 'ports', 'role', 'displayLocation'],
  firewall: ['brand', 'model', 'serialNumber', 'ipManagement', 'macEth', 'haMode', 'haPeerAssetId', 'displayLocation'],
  ap:       ['brand', 'model', 'serialNumber', 'ipManagement', 'macWifi', 'macEth', 'displayLocation'],
  // ── CCTV ──────────────────────────────────────────────────────────────────
  camera:   ['brand', 'model', 'serialNumber', 'internalCode', 'cameraType', 'megapixels', 'nvrChannel', 'ipManagement', 'displayLocation'],
  // ── Servidores / DC ───────────────────────────────────────────────────────
  server:   ['brand', 'model', 'serialNumber', 'ipManagement', 'operatingSystem', 'role', 'displayLocation'],
  ups:      ['brand', 'model', 'serialNumber', 'displayLocation'],
  rack:     ['brand', 'model', 'displayLocation'],
};

// Agrupación por dominio para el filtro del listado. El orden define el orden
// en el dropdown. Categorías sin dominio explícito caen en 'it'.
export const DOMAINS = [
  { key: 'it',         label: 'IT',              slugs: ['desktop', 'notebook', 'monitor', 'printer', 'tv', 'phone', 'tablet', 'mouse', 'keyboard', 'stand', 'mousepad'] },
  { key: 'networking', label: 'Networking',      slugs: ['switch', 'firewall', 'ap'] },
  { key: 'cctv',       label: 'CCTV / Cámaras',  slugs: ['camera'] },
  { key: 'dc',         label: 'Servidores / DC', slugs: ['server', 'ups', 'rack'] },
];

const SLUG_TO_DOMAIN = DOMAINS.reduce((acc, d) => {
  d.slugs.forEach(s => { acc[s] = d.key; });
  return acc;
}, {});

export function domainOf(slug) {
  return SLUG_TO_DOMAIN[slug] || 'it';
}

// Solo los activos de IT se entregan a funcionarios (assign + actas).
// Networking / CCTV / DC son infraestructura: se ubican, no se asignan a personas.
export function isAssignable(slug) {
  return domainOf(slug) === 'it';
}

// Opciones de selects específicos por campo/categoría.
export const CAMERA_TYPES = ['PTZ', 'Turret', 'Bullet', 'Fisheye', 'Domo', 'Analógica'];
export const HA_MODES = ['active', 'passive'];
export function roleOptions(slug) {
  if (slug === 'switch') return ['core', 'aggregation', 'distribution', 'access'];
  if (slug === 'server') return ['hypervisor', 'app', 'db', 'storage', 'backup'];
  return [];
}

export function fieldsForCategory(slug) {
  if (!slug) return ALL;
  return MAP[slug] || ALL;
}

export function showsField(slug, field) {
  return fieldsForCategory(slug).includes(field);
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación masiva — plantillas CSV por categoría
// ─────────────────────────────────────────────────────────────────────────────
// Etiquetas legibles (español) de cada campo importable. Se usan como encabezado
// de la plantilla y para el mapeo tolerante header→key al parsear.
export const FIELD_LABELS = {
  tag:             'TAG',
  brand:           'Marca',
  model:           'Modelo',
  serialNumber:    'N° de serie',
  operatingSystem: 'Sistema operativo',
  macWifi:         'MAC WiFi',
  macEth:          'MAC Ethernet',
  imei:            'IMEI',
  ipManagement:    'IP de gestión',
  internalCode:    'Código interno',
  nvrChannel:      'Canal NVR',
  cameraType:      'Tipo de cámara',
  megapixels:      'Megapíxeles',
  ports:           'N° de puertos',
  role:            'Rol',
  haMode:          'Modo HA',
  haPeerAssetId:   'Peer HA (TAG)',
  displayLocation: 'Ubicación física',
  status:          'Estado',
  condition:       'Condición',
  locationSlug:    'Ubicación (código)',
  departmentSlug:  'Departamento (código)',
  vendor:          'Proveedor',
  warrantyUntil:   'Garantía (AAAA-MM-DD)',
  notes:           'Observaciones',
};

// Columnas de la plantilla de import para una categoría: TAG (opcional, si va
// vacío se autogenera) + campos propios de la categoría + comunes.
const IMPORT_COMMON_TAIL = ['status', 'condition', 'locationSlug', 'departmentSlug', 'vendor', 'warrantyUntil', 'notes'];
export function importColumns(slug) {
  return [...new Set(['tag', ...fieldsForCategory(slug), ...IMPORT_COMMON_TAIL])];
}

// Mapeo tolerante de encabezado CSV → clave interna. Acepta la etiqueta en
// español (con o sin acentos/mayúsculas) o la clave cruda. Si no matchea,
// devuelve el header tal cual (compat hacia atrás con CSVs viejos).
const _norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const _HEADER_INDEX = (() => {
  const idx = {};
  for (const key of Object.keys(FIELD_LABELS)) {
    idx[_norm(key)] = key;
    idx[_norm(FIELD_LABELS[key])] = key;
  }
  idx[_norm('categorySlug')] = 'categorySlug';
  idx[_norm('Categoría (código)')] = 'categorySlug';
  return idx;
})();
export function headerToKey(header) {
  return _HEADER_INDEX[_norm(header)] || String(header || '').trim();
}
