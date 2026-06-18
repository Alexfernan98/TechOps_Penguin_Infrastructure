// Mapa de campos visibles del formulario "Nuevo activo" / "Editar activo"
// por slug de categoría. Si la categoría no está en el mapa, se muestran TODOS
// los campos (fallback seguro para categorías nuevas).
//
// Campos posibles: brand, model, serialNumber, operatingSystem,
//                  macWifi, macEth, imei
//
// Categorías base (seed): desktop, notebook, monitor, printer, tv,
//                         mouse, mousepad, keyboard, stand, phone, tablet

const ALL = ['brand', 'model', 'serialNumber', 'operatingSystem', 'macWifi', 'macEth', 'imei'];

const MAP = {
  desktop:  ['brand', 'model', 'serialNumber', 'operatingSystem', 'macWifi', 'macEth'],
  notebook: ['brand', 'model', 'serialNumber', 'operatingSystem', 'macWifi', 'macEth'],
  monitor:  ['brand', 'model', 'serialNumber'],
  printer:  ['brand', 'model', 'serialNumber', 'macWifi', 'macEth'],
  tv:       ['brand', 'model', 'serialNumber', 'macWifi'],
  phone:    ['brand', 'model', 'serialNumber', 'imei', 'operatingSystem'],
  tablet:   ['brand', 'model', 'serialNumber', 'imei', 'operatingSystem', 'macWifi'],
  mouse:    ['brand', 'model'],
  keyboard: ['brand', 'model'],
  stand:    ['brand', 'model'],
  mousepad: ['brand'],
};

export function fieldsForCategory(slug) {
  if (!slug) return ALL;
  return MAP[slug] || ALL;
}

export function showsField(slug, field) {
  return fieldsForCategory(slug).includes(field);
}
