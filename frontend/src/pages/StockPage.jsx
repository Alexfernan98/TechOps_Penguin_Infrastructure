import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Package, Download, Upload, Rocket, SlidersHorizontal, Settings2, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { stockApi, stockGroupsApi } from '@/api/stock';
import { categoriesApi, locationsApi, departmentsApi } from '@/api/org';
import Drawer from '@/components/ui/Drawer';
import Modal from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import useAuthStore from '@/store/authStore';
import { SortableTh, FilterSelect, ClearFiltersButton } from '@/components/ui/TableFilters';
import { AssetFieldset } from '@/components/ui/AssetFieldset';
import { parseCsv } from '@/lib/csv';
import { isAssignable } from '@/lib/categoryFields';

// Unidades sugeridas para el dropdown de la plantilla.
const UNITS = ['unidad', 'metro', 'rollo', 'caja', 'par', 'juego', 'bobina'];

const fmtDate = (d) => d ? new Date(d).toLocaleString('es-PY') : '—';
const inputCls = 'mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500';
const Field = ({ label, children }) => <div><label className="text-xs font-medium text-slate-500">{label}</label>{children}</div>;

// Tipos de movimiento manual → (reason, signo).
const MOVEMENT_TYPES = [
  { key: 'in',       label: 'Entrada (compra/ingreso)', reason: 'PURCHASE', sign: +1 },
  { key: 'out',      label: 'Salida (uso/instalación)', reason: 'CONSUME',  sign: -1 },
  { key: 'return',   label: 'Devolución al stock',      reason: 'RETURN',   sign: +1 },
  { key: 'adjust_up',   label: 'Ajuste (+)',            reason: 'ADJUST',   sign: +1 },
  { key: 'adjust_down', label: 'Ajuste (−)',            reason: 'ADJUST',   sign: -1 },
];
const REASON_LABEL = { INITIAL: 'Carga inicial', PURCHASE: 'Entrada', CONSUME: 'Salida', ADJUST: 'Ajuste', RETURN: 'Devolución', DEPLOY: 'Despliegue a activo' };

export default function StockPage() {
  const { user: me } = useAuthStore();
  const canWrite = ['IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN'].includes(me?.role);
  const canAdmin = ['IT_ADMIN', 'SUPER_ADMIN'].includes(me?.role);

  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [cats, setCats] = useState([]);
  const [locs, setLocs] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ search: '', group: '', type: '', lowStock: '' });
  const [sort, setSort] = useState({ by: 'name', dir: 'asc' });
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await stockApi.list()); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, []);
  const reloadCatalogs = useCallback(async () => {
    try {
      const [g, c, l, d] = await Promise.all([
        stockGroupsApi.list().catch(() => []),
        categoriesApi.list().catch(() => []),
        locationsApi.list().catch(() => []),
        departmentsApi.list().catch(() => []),
      ]);
      setGroups(Array.isArray(g) ? g : []);
      setCats(Array.isArray(c) ? c : []);
      setLocs(Array.isArray(l) ? l : []);
      setDepts(Array.isArray(d) ? d : []);
    } catch { /* opcional */ }
  }, []);

  useEffect(() => { reload(); reloadCatalogs(); }, [reload, reloadCatalogs]);

  const groupName = (slug) => groups.find(g => g.slug === slug)?.name || slug;
  const catName = (slug) => cats.find(c => c.slug === slug)?.name || slug;

  const toggleSort = (by) => setSort(s => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));
  const clearFilters = () => setF({ search: '', group: '', type: '', lowStock: '' });

  const filtered = useMemo(() => {
    const list = items.filter(i => {
      if (f.group && i.groupSlug !== f.group) return false;
      if (f.type === 'convertible' && !i.convertible) return false;
      if (f.type === 'consumable' && i.convertible) return false;
      if (f.lowStock === 'true' && !i.lowStock) return false;
      if (f.search) { const s = f.search.toLowerCase(); if (![i.name, i.brand, i.model].some(v => (v || '').toLowerCase().includes(s))) return false; }
      return true;
    });
    const acc = {
      name: i => (i.name || '').toLowerCase(),
      group: i => groupName(i.groupSlug).toLowerCase(),
      quantity: i => i.quantity,
      unit: i => (i.unit || '').toLowerCase(),
      location: i => (i.location || '~').toLowerCase(),
    };
    const get = acc[sort.by] || acc.name;
    return [...list].sort((a, b) => {
      const av = get(a); const bv = get(b);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, f, sort, groups]);

  const kpis = useMemo(() => ({
    lines: items.length,
    units: items.reduce((s, i) => s + (i.quantity || 0), 0),
    low: items.filter(i => i.lowStock).length,
  }), [items]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Almacén</h2>
          <p className="text-slate-500 mt-1">Repuestos y consumibles · {items.length} ítems</p>
        </div>
        <div className="flex gap-2">
          {canAdmin && <button onClick={() => setShowGroups(true)} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"><Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Grupos</span></button>}
          {canAdmin && <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span></button>}
          {canWrite && <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"><Plus className="w-4 h-4" /> Nuevo ítem</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {[['Ítems', kpis.lines, 'text-slate-700'], ['Unidades totales', kpis.units, 'text-blue-600'], ['Stock bajo', kpis.low, 'text-amber-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{l}</p><p className={`text-2xl font-bold mt-1 ${c}`}>{v}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={f.search} onChange={e => setF({ ...f, search: e.target.value })} placeholder="Buscar por nombre, marca, modelo…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2">
          <FilterSelect value={f.group} onChange={v => setF({ ...f, group: v })} placeholder="Todos los grupos" options={groups.map(g => ({ value: g.slug, label: g.name }))} />
          <FilterSelect value={f.type}  onChange={v => setF({ ...f, type: v })}  placeholder="Convertible y consumible" options={[{ value: 'convertible', label: 'Convertible a activo' }, { value: 'consumable', label: 'Consumible' }]} />
          <button
            onClick={() => setF({ ...f, lowStock: f.lowStock === 'true' ? '' : 'true' })}
            className={`col-span-2 md:col-auto px-3 py-2 text-sm font-medium rounded-lg ${f.lowStock === 'true' ? 'bg-amber-700 hover:bg-amber-800 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'}`}
          >Solo stock bajo{f.lowStock === 'true' ? ' ✓' : ''}</button>
          <ClearFiltersButton onClick={clearFilters} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <SortableTh sort={sort} by="name"     onClick={toggleSort}>Ítem</SortableTh>
                <SortableTh sort={sort} by="group"    onClick={toggleSort}>Grupo</SortableTh>
                <th className="px-4 py-3">Tipo</th>
                <SortableTh sort={sort} by="quantity" onClick={toggleSort}>Cantidad</SortableTh>
                <SortableTh sort={sort} by="unit"     onClick={toggleSort}>Unidad</SortableTh>
                <SortableTh sort={sort} by="location" onClick={toggleSort}>Ubicación WH</SortableTh>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Sin ítems</td></tr>}
              {!loading && filtered.map(i => (
                <tr key={i.id} onClick={() => setSelectedId(i.id)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{i.name}</p>
                    {(i.brand || i.model) && <p className="text-xs text-slate-400">{`${i.brand || ''} ${i.model || ''}`.trim()}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{groupName(i.groupSlug)}</td>
                  <td className="px-4 py-3">
                    {i.convertible
                      ? <span className="px-2 py-0.5 text-[11px] rounded bg-blue-50 text-blue-700 border border-blue-200">Convertible · {catName(i.categorySlug)}</span>
                      : <span className="px-2 py-0.5 text-[11px] rounded bg-slate-100 text-slate-600 border border-slate-200">Consumible</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${i.lowStock ? 'text-amber-600' : 'text-slate-800'}`}>{i.quantity}</span>
                    {i.lowStock && <AlertTriangle className="inline w-3.5 h-3.5 text-amber-500 ml-1 -mt-0.5" title={`Bajo el mínimo (${i.minQuantity})`} />}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{i.unit}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{i.location || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && <StockDrawer id={selectedId} groups={groups} cats={cats} locs={locs} depts={depts} canWrite={canWrite} canAdmin={canAdmin} onClose={() => setSelectedId(null)} onRefresh={reload} />}
      {showNew && <StockItemModal groups={groups} cats={cats} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); reload(); }} />}
      {showGroups && <GroupsModal groups={groups} onClose={() => setShowGroups(false)} onChanged={reloadCatalogs} />}
      {showImport && <StockImportModal groups={groups} cats={cats} onClose={() => setShowImport(false)} onDone={reload} />}
    </div>
  );
}

function StockDrawer({ id, groups, cats, locs, depts, canWrite, canAdmin, onClose, onRefresh }) {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // 'edit' | 'move'
  const load = useCallback(async () => {
    try { setData(await stockApi.get(id)); } catch (e) { toast.error(e.response?.data?.error || e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const groupName = (slug) => groups.find(g => g.slug === slug)?.name || slug;
  const catName = (slug) => cats.find(c => c.slug === slug)?.name || slug;

  const afterMutation = () => { load(); onRefresh(); setModal(null); };

  const remove = async () => {
    const ok = await confirm({ title: 'Dar de baja ítem', description: `¿Eliminar "${data?.item?.name}" del almacén? El historial de movimientos se conserva.`, confirmLabel: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    try { await stockApi.remove(id); toast.success('Ítem eliminado'); onRefresh(); onClose(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  if (!data) return <Drawer open onClose={onClose} title="Cargando…" width={560}><p className="text-slate-400">Cargando…</p></Drawer>;
  const { item, movements } = data;

  return (
    <>
      <Drawer open onClose={onClose} width={560}
        title={item.name}
        subtitle={`${item.brand || ''} ${item.model || ''}`.trim() || groupName(item.groupSlug)}
        footer={canWrite ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setModal('move')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg inline-flex items-center gap-1.5"><SlidersHorizontal className="w-4 h-4" /> Movimiento</button>
              {data.item.convertible && data.item.quantity > 0 &&
                <button onClick={() => setModal('deploy')} className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg inline-flex items-center gap-1.5"><Rocket className="w-4 h-4" /> {isAssignable(data.item.categorySlug) ? 'Dar de alta desde stock' : 'Poner en producción'}</button>}
              <button onClick={() => setModal('edit')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Editar</button>
            </div>
            {canAdmin && <button onClick={remove} className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium rounded-lg hover:bg-rose-100 inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Eliminar</button>}
          </div>
        ) : null}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-3xl font-bold ${item.lowStock ? 'text-amber-600' : 'text-slate-800'}`}>{item.quantity}</span>
          <span className="text-slate-500">{item.unit}{item.quantity !== 1 ? 's' : ''} en stock</span>
          {item.lowStock && <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-700 border border-amber-200">Bajo el mínimo ({item.minQuantity})</span>}
        </div>
        <dl className="mb-6">
          <KV label="Grupo">{groupName(item.groupSlug)}</KV>
          <KV label="Tipo">{item.convertible ? `Convertible a activo · ${catName(item.categorySlug)}` : 'Consumible'}</KV>
          {item.minQuantity != null && <KV label="Stock mínimo">{item.minQuantity}</KV>}
          <KV label="Ubicación WH">{item.location || '—'}</KV>
          <KV label="Observaciones">{item.notes || '—'}</KV>
        </dl>

        <h3 className="text-sm font-semibold text-slate-700 mb-2">Movimientos</h3>
        <div className="space-y-1.5">
          {(movements || []).length === 0 && <p className="text-slate-400 text-sm">Sin movimientos.</p>}
          {(movements || []).map(m => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 text-sm">
              <div>
                <span className={`font-semibold ${m.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{m.delta >= 0 ? '+' : ''}{m.delta}</span>
                <span className="text-slate-500 ml-2">{REASON_LABEL[m.reason] || m.reason}</span>
                {m.notes && <span className="text-slate-400"> · {m.notes}</span>}
              </div>
              <span className="text-xs text-slate-400">{fmtDate(m.createdAt)}</span>
            </div>
          ))}
        </div>
      </Drawer>

      {modal === 'edit' && <StockItemModal item={item} groups={groups} cats={cats} onClose={() => setModal(null)} onSaved={afterMutation} />}
      {modal === 'move' && <MovementModal item={item} onClose={() => setModal(null)} onDone={afterMutation} />}
      {modal === 'deploy' && <DeployModal item={item} catName={catName} locs={locs} depts={depts} onClose={() => setModal(null)} onDone={afterMutation} />}
    </>
  );
}

const KV = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-slate-100 text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-slate-800 text-right">{children}</dd>
  </div>
);

function StockItemModal({ item, groups, cats, onClose, onSaved }) {
  const editing = !!item;
  const [form, setForm] = useState({
    name: item?.name || '', groupSlug: item?.groupSlug || (groups[0]?.slug || ''),
    categorySlug: item?.categorySlug || '', brand: item?.brand || '', model: item?.model || '',
    unit: item?.unit || 'unidad', quantity: item?.quantity ?? 0,
    minQuantity: item?.minQuantity ?? '', location: item?.location || '', notes: item?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const convertible = !!form.categorySlug;

  const submit = async () => {
    setBusy(true);
    try {
      if (editing) { await stockApi.update(item.id, form); toast.success('Ítem actualizado'); }
      else { const it = await stockApi.create(form); toast.success(`Ítem "${it.name}" creado`); }
      onSaved();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={editing ? `Editar · ${item.name}` : 'Nuevo ítem de almacén'} width={620}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !form.name || !form.groupSlug} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">{editing ? 'Guardar' : 'Crear ítem'}</button></div>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Nombre / descripción *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Switch TP-LINK TL-SG1024D 24P" /></Field></div>
        <Field label="Grupo *"><select value={form.groupSlug} onChange={e => setForm({ ...form, groupSlug: e.target.value })} className={inputCls}>{groups.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}</select></Field>
        <Field label="Tipo">
          <select value={form.categorySlug} onChange={e => setForm({ ...form, categorySlug: e.target.value })} className={inputCls}>
            <option value="">Consumible (no se convierte en activo)</option>
            <optgroup label="Convertible a activo — categoría:">
              {cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </optgroup>
          </select>
        </Field>
        <Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className={inputCls} /></Field>
        <Field label="Modelo"><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={inputCls} /></Field>
        {!editing && <Field label="Cantidad inicial"><input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className={inputCls} /></Field>}
        <Field label="Unidad"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="unidad / metro / rollo" /></Field>
        <Field label="Stock mínimo (alerta)"><input type="number" min="0" value={form.minQuantity} onChange={e => setForm({ ...form, minQuantity: e.target.value })} className={inputCls} placeholder="opcional" /></Field>
        <Field label="Ubicación WH"><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="WH3 / Depósito" /></Field>
        <div className="col-span-2"><Field label="Observaciones"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></Field></div>
        {convertible && editing && <div className="col-span-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">Este ítem es <strong>convertible</strong>: en una próxima fase vas a poder desplegar unidades a Inventario como activos.</div>}
      </div>
    </Modal>
  );
}

function MovementModal({ item, onClose, onDone }) {
  const [type, setType] = useState('in');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const mt = MOVEMENT_TYPES.find(t => t.key === type);
  const q = Math.max(1, parseInt(qty, 10) || 0);
  const delta = mt.sign * q;
  const resulting = item.quantity + delta;
  const invalid = resulting < 0;

  const submit = async () => {
    setBusy(true);
    try {
      await stockApi.movement(item.id, { delta, reason: mt.reason, notes });
      toast.success('Movimiento registrado');
      onDone();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Movimiento · ${item.name}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || invalid || q < 1} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Registrar</button></div>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Stock actual: <strong>{item.quantity}</strong> {item.unit}(s)</p>
        <Field label="Tipo de movimiento"><select value={type} onChange={e => setType(e.target.value)} className={inputCls}>{MOVEMENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
        <Field label="Cantidad"><input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></Field>
        <Field label="Nota (opcional)"><input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Ej. compra OC-123 / instalación Caseta Mara2" /></Field>
        <div className={`p-3 rounded-lg text-sm border ${invalid ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          Resultado: <strong>{item.quantity}</strong> {delta >= 0 ? '+' : '−'} {q} = <strong>{resulting}</strong> {item.unit}(s)
          {invalid && <div className="mt-1 text-rose-600">No hay stock suficiente para esa salida.</div>}
        </div>
      </div>
    </Modal>
  );
}

function DeployModal({ item, catName, locs, depts, onClose, onDone }) {
  const assignable = isAssignable(item.categorySlug);       // IT (se entrega a persona) vs infra
  const targetStatus = assignable ? 'AVAILABLE' : 'IN_PRODUCTION';
  const statusLabel = assignable ? 'Disponible' : 'En producción';
  // Form pre-cargado con marca/modelo del ítem de stock; el resto se completa acá.
  const [form, setForm] = useState({
    brand: item.brand || '', model: item.model || '', serialNumber: '', operatingSystem: '',
    macWifi: '', macEth: '', imei: '', condition: 'GOOD', locationSlug: '', departmentSlug: '',
    vendor: '', warrantyUntil: '', details: '', notes: '',
    ipManagement: '', internalCode: '', nvrChannel: '', cameraType: '', megapixels: '', ports: '', role: '', haMode: '', haPeerAssetId: '', displayLocation: '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const out = await stockApi.deploy(item.id, { ...form, status: targetStatus });
      toast.success(`Creado ${out.asset.tag} · stock ${out.item.quantity}`);
      onDone();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${assignable ? 'Dar de alta desde stock' : 'Poner en producción'} · ${item.name}`} width={640}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Crear activo</button></div>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800">
          Se descuenta <strong>1 unidad</strong> del stock (quedan {item.quantity - 1}) y se crea un activo <strong>{catName(item.categorySlug)}</strong> con TAG automático, en estado <strong>{statusLabel}</strong>.
          {assignable && ' Después lo asignás a un funcionario desde Inventario (con su acta de entrega).'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AssetFieldset form={form} setForm={setForm} categorySlug={item.categorySlug} locs={locs} depts={depts} />
          <div className="col-span-2"><Field label="Observaciones"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></Field></div>
        </div>
      </div>
    </Modal>
  );
}

// Construye el spec de columnas de la plantilla de import de almacén.
function stockTemplateColumns(groups, cats) {
  return [
    { key: 'name',         label: 'Nombre' },
    { key: 'groupSlug',    label: 'Grupo',            options: groups.map(g => g.name) },
    { key: 'categorySlug', label: 'Tipo',             options: ['Consumible', ...cats.map(c => c.name)] },
    { key: 'brand',        label: 'Marca' },
    { key: 'model',        label: 'Modelo' },
    { key: 'unit',         label: 'Unidad',           options: UNITS },
    { key: 'quantity',     label: 'Cantidad' },
    { key: 'minQuantity',  label: 'Stock mínimo' },
    { key: 'location',     label: 'Ubicación WH' },
    { key: 'notes',        label: 'Observaciones' },
  ];
}

function StockImportModal({ groups, cats, onClose, onDone }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const columns = stockTemplateColumns(groups, cats);

  // header → clave interna a partir del spec de columnas.
  const _norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const headerIdx = {};
  columns.forEach(c => { headerIdx[_norm(c.label)] = c.key; headerIdx[_norm(c.key)] = c.key; });
  const headerToKey = (h) => headerIdx[_norm(h)] || String(h || '').trim();

  const downloadTemplate = async () => {
    setErr(null);
    try {
      const blob = await stockApi.importTemplate('plantilla_almacen', columns);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'plantilla_almacen.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setErr('No se pudo generar la plantilla: ' + (e.response?.data?.error || e.message)); }
  };

  const onFile = (e) => {
    const ff = e.target.files?.[0];
    if (!ff) return;
    setErr(null);
    if (/\.xlsx$/i.test(ff.name)) { setFile(ff); setText(''); }
    else { setFile(null); const r = new FileReader(); r.onload = () => setText(String(r.result || '')); r.readAsText(ff, 'utf-8'); }
  };

  const submit = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      let r;
      if (file) r = await stockApi.importFile(file, columns);
      else {
        const rows = parseCsv(text, headerToKey);
        if (rows.length === 0) throw new Error('No se detectaron filas (encabezados + al menos una fila).');
        r = await stockApi.import(rows);
      }
      setResult(r);
      toast.success(`Import OK: ${r.created || 0} creados · ${r.skipped || 0} omitidos`);
      onDone?.();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  const canProcess = !!file || !!text.trim();

  return (
    <Modal open onClose={onClose} title="Importar al almacén" width={700}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>{!result && <button onClick={submit} disabled={busy || !canProcess} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">{busy ? 'Procesando…' : 'Procesar'}</button>}</div>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <strong>1.</strong> Descargá la plantilla Excel (trae desplegables en Grupo, Tipo y Unidad). <strong>2.</strong> Completá los ítems. En <strong>Tipo</strong> elegí "Consumible" o la categoría de activo si es convertible. <strong>3.</strong> Subí el <code className="text-xs">.xlsx</code>.
          <br />Se crean ítems nuevos; si ya existe uno con el mismo nombre en el mismo grupo, se omite (no duplica).
        </div>
        <button onClick={downloadTemplate} className="px-3 py-2 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 inline-flex items-center gap-1.5"><Download className="w-4 h-4" /> Descargar plantilla Excel</button>

        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 whitespace-pre-wrap">{err}</div>}

        {result ? (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <p className="font-medium">Importación completada</p>
            <ul className="mt-2 space-y-0.5 text-emerald-700">
              <li>Creados: <strong>{result.created || 0}</strong></li>
              <li>Omitidos (duplicados/vacíos): <strong>{result.skipped || 0}</strong></li>
              {Array.isArray(result.errors) && result.errors.length > 0 && <li className="text-rose-700">Errores: <strong>{result.errors.length}</strong></li>}
            </ul>
            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <ul className="mt-2 text-xs text-rose-600 max-h-32 overflow-y-auto">{result.errors.slice(0, 20).map((er, i) => <li key={i}>Fila {er.row + 1}: {er.error}</li>)}</ul>
            )}
          </div>
        ) : (
          <>
            <Field label="Subir archivo (.xlsx o .csv)">
              <input type="file" accept=".xlsx,.csv,text/csv" onChange={onFile} className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              {file && <p className="mt-1 text-xs text-emerald-600">Archivo listo: <strong>{file.name}</strong></p>}
            </Field>
            <Field label="…o pegá contenido CSV (avanzado)">
              <textarea value={text} onChange={e => { setText(e.target.value); if (e.target.value) setFile(null); }} rows={5} placeholder="Nombre,Grupo,Tipo,...&#10;Ficha RJ45,Networking,Consumible,,,unidad,49,10,WH3," className={`${inputCls} font-mono text-xs`} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}

function GroupsModal({ groups, onClose, onChanged }) {
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingSlug, setEditingSlug] = useState(null);
  const [editName, setEditName] = useState('');

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try { await stockGroupsApi.create({ name: newName.trim() }); setNewName(''); onChanged(); toast.success('Grupo creado'); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  const saveEdit = async (slug) => {
    if (!editName.trim()) return;
    try { await stockGroupsApi.update(slug, { name: editName.trim() }); setEditingSlug(null); onChanged(); toast.success('Grupo actualizado'); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };
  const del = async (g) => {
    const ok = await confirm({ title: 'Eliminar grupo', message: `¿Eliminar el grupo "${g.name}"?`, confirmText: 'Eliminar', danger: true });
    if (!ok) return;
    try { await stockGroupsApi.remove(g.slug); onChanged(); toast.success('Grupo eliminado'); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  return (
    <Modal open onClose={onClose} title="Gestionar grupos de almacén" width={520}
      footer={<div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button></div>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Nuevo grupo…" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <button onClick={add} disabled={busy || !newName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Agregar</button>
        </div>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {groups.map(g => (
            <div key={g.slug} className="flex items-center gap-2 px-3 py-2">
              {editingSlug === g.slug ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(g.slug)} className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm" autoFocus />
                  <button onClick={() => saveEdit(g.slug)} className="text-sm text-blue-600 font-medium">Guardar</button>
                  <button onClick={() => setEditingSlug(null)} className="text-sm text-slate-400">Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-700">{g.name} <span className="text-xs text-slate-400 font-mono">{g.slug}</span></span>
                  <button onClick={() => { setEditingSlug(g.slug); setEditName(g.name); }} className="text-sm text-slate-500 hover:text-slate-700">Editar</button>
                  <button onClick={() => del(g)} className="text-sm text-rose-500 hover:text-rose-700">Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">Un grupo no se puede eliminar si tiene ítems. Reasigná los ítems primero.</p>
      </div>
    </Modal>
  );
}
