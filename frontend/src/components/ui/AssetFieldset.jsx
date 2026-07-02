import { fieldsForCategory, CAMERA_TYPES, HA_MODES, roleOptions } from '@/lib/categoryFields';
import { CONDITION_LABEL } from '@/components/ui/Badge';

// Estilos compartidos de formulario.
export const inputCls = 'mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500';
export const Field = ({ label, children }) => <div><label className="text-xs font-medium text-slate-500">{label}</label>{children}</div>;

const CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'DAMAGED'];

// Campos de activo según su categoría. Fuente ÚNICA usada por el alta, la
// edición y el despliegue desde almacén — así los tres muestran exactamente
// los campos correctos por tipo (celular→IMEI/SO, switch→puertos/rol, etc.).
//
// `show` habilita las secciones no-técnicas (por defecto todo salvo purchaseDate).
// El caller provee el <div className="grid grid-cols-2 gap-3"> que envuelve esto.
export function AssetFieldset({ form, setForm, categorySlug, locs = [], depts = [], show = {} }) {
  const visible = fieldsForCategory(categorySlug);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const roles = roleOptions(categorySlug);
  const s = { condition: true, location: true, department: true, vendor: true, warranty: true, purchaseDate: false, details: true, ...show };
  return (
    <>
      {visible.includes('brand')           && <Field label="Marca"><input value={form.brand || ''} onChange={set('brand')} className={inputCls} /></Field>}
      {visible.includes('model')           && <Field label="Modelo"><input value={form.model || ''} onChange={set('model')} className={inputCls} /></Field>}
      {visible.includes('serialNumber')    && <Field label="Número de serie"><input value={form.serialNumber || ''} onChange={set('serialNumber')} className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('imei')            && <Field label="IMEI"><input value={form.imei || ''} onChange={set('imei')} className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('operatingSystem') && <Field label="Sistema operativo"><input value={form.operatingSystem || ''} onChange={set('operatingSystem')} className={inputCls} /></Field>}
      {visible.includes('macWifi')         && <Field label="MAC WiFi"><input value={form.macWifi || ''} onChange={set('macWifi')} placeholder="AA:BB:CC:DD:EE:FF" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('macEth')          && <Field label="MAC Ethernet"><input value={form.macEth || ''} onChange={set('macEth')} placeholder="AA:BB:CC:DD:EE:FF" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('ipManagement')    && <Field label="IP de gestión"><input value={form.ipManagement || ''} onChange={set('ipManagement')} placeholder="10.0.0.1" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('ports')           && <Field label="N° de puertos"><input type="number" min="0" value={form.ports ?? ''} onChange={set('ports')} className={inputCls} /></Field>}
      {visible.includes('role')            && <Field label="Rol"><select value={form.role || ''} onChange={set('role')} className={inputCls}><option value="">—</option>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></Field>}
      {visible.includes('haMode')          && <Field label="Modo HA"><select value={form.haMode || ''} onChange={set('haMode')} className={inputCls}><option value="">—</option>{HA_MODES.map(m => <option key={m} value={m}>{m}</option>)}</select></Field>}
      {visible.includes('haPeerAssetId')   && <Field label="Peer HA (TAG)"><input value={form.haPeerAssetId || ''} onChange={set('haPeerAssetId')} placeholder="PE1H-NET-FW-002" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('cameraType')      && <Field label="Tipo de cámara"><select value={form.cameraType || ''} onChange={set('cameraType')} className={inputCls}><option value="">—</option>{CAMERA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>}
      {visible.includes('megapixels')      && <Field label="Megapíxeles"><input type="number" min="0" step="1" value={form.megapixels ?? ''} onChange={set('megapixels')} className={inputCls} /></Field>}
      {visible.includes('internalCode')    && <Field label="Código interno"><input value={form.internalCode || ''} onChange={set('internalCode')} placeholder="DC.H 120 / A11" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('nvrChannel')      && <Field label="Canal NVR"><input value={form.nvrChannel || ''} onChange={set('nvrChannel')} placeholder="D1 / Surveillance" className={inputCls} /></Field>}
      {s.condition    && <Field label="Condición"><select value={form.condition || 'GOOD'} onChange={set('condition')} className={inputCls}>{CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select></Field>}
      {s.location     && <Field label="Ubicación"><select value={form.locationSlug || ''} onChange={set('locationSlug')} className={inputCls}><option value="">—</option>{locs.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select></Field>}
      {s.department   && <Field label="Departamento"><select value={form.departmentSlug || ''} onChange={set('departmentSlug')} className={inputCls}><option value="">—</option>{depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></Field>}
      {s.purchaseDate && <Field label="Fecha de compra"><input type="date" value={form.purchaseDate || ''} onChange={set('purchaseDate')} className={inputCls} /></Field>}
      {s.warranty     && <Field label="Garantía hasta"><input type="date" value={form.warrantyUntil || ''} onChange={set('warrantyUntil')} className={inputCls} /></Field>}
      {visible.includes('displayLocation') && <div className="col-span-2"><Field label="Ubicación física (descripción)"><input value={form.displayLocation || ''} onChange={set('displayLocation')} placeholder="PTZ Caseta Mara2 / Comedor Central-1" className={inputCls} /></Field></div>}
      {s.vendor       && <div className="col-span-2"><Field label="Proveedor"><input value={form.vendor || ''} onChange={set('vendor')} className={inputCls} /></Field></div>}
      {s.details      && <div className="col-span-2"><Field label="Detalles / Specs"><textarea value={form.details || ''} onChange={set('details')} rows={2} className={inputCls} /></Field></div>}
    </>
  );
}
