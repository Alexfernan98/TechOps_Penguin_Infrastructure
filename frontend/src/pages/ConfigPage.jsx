import { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Users as UsersIcon, MapPin, Tag } from 'lucide-react';
import { departmentsApi, locationsApi, categoriesApi } from '@/api/org';
import Modal from '@/components/ui/Modal';
import clsx from 'clsx';

const TABS = [
  { key: 'departments', label: 'Departamentos' },
  { key: 'locations',   label: 'Ubicaciones' },
  { key: 'categories',  label: 'Categorías de activo' },
];

export default function ConfigPage() {
  const [tab, setTab] = useState('departments');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Configuración</h2>
        <p className="text-slate-500 mt-1">Catálogos editables del sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-4">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium border-b-2 -mb-px',
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {tab === 'departments' && <DepartmentsTab />}
          {tab === 'locations'   && <LocationsTab />}
          {tab === 'categories'  && <CategoriesTab />}
        </div>
      </div>
    </div>
  );
}

// ── Departamentos ─────────────────────────────────────────────────────────────
function DepartmentsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const reload = async () => {
    setLoading(true);
    setItems(await departmentsApi.list());
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const roots    = items.filter(d => !d.parentSlug);
  const children = (slug) => items.filter(d => d.parentSlug === slug);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{items.length} entradas · árbol de 2 niveles</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo departamento
        </button>
      </div>
      {loading ? <p className="text-slate-400 py-6 text-center">Cargando…</p> : (
        <ul className="space-y-1">
          {roots.map(r => (
            <li key={r.slug}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-slate-800">{r.name}</span>
                <span className="text-xs text-slate-400 font-mono">{r.slug}</span>
              </div>
              {children(r.slug).map(c => (
                <div key={c.slug} className="flex items-center gap-2 px-3 py-2 ml-6 rounded-lg hover:bg-slate-50">
                  <UsersIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{c.name}</span>
                  <span className="text-xs text-slate-400 font-mono">{c.slug}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <NewDeptModal open={showNew} parents={roots} onClose={() => setShowNew(false)} onSaved={() => { reload(); setShowNew(false); }} />
    </div>
  );
}

function NewDeptModal({ open, parents, onClose, onSaved }) {
  const [form, setForm] = useState({ slug: '', name: '', parentSlug: '', type: 'DEPARTMENT' });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  useEffect(() => { if (open) { setForm({ slug: '', name: '', parentSlug: '', type: 'DEPARTMENT' }); setErr(null); } }, [open]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await departmentsApi.create({ ...form, parentSlug: form.parentSlug || null });
      onSaved();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo departamento"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={submit} disabled={busy || !form.slug || !form.name} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Crear</button>
        </div>
      }
    >
      <div className="space-y-3">
        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>}
        <div>
          <label className="text-xs font-medium text-slate-500">Slug *</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toUpperCase() })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" placeholder="MINING_OPS_NEW" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Padre (opcional)</label>
          <select value={form.parentSlug} onChange={(e) => setForm({ ...form, parentSlug: e.target.value, type: e.target.value ? 'TEAM' : 'DEPARTMENT' })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">— Raíz (DEPARTMENT) —</option>
            {parents.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ── Ubicaciones ───────────────────────────────────────────────────────────────
function LocationsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const reload = async () => { setLoading(true); setItems(await locationsApi.list()); setLoading(false); };
  useEffect(() => { reload(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{items.length} ubicaciones</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Nueva ubicación
        </button>
      </div>
      {loading ? <p className="text-slate-400 py-6 text-center">Cargando…</p> : (
        <table className="w-full">
          <thead className="text-xs font-semibold text-slate-500 uppercase">
            <tr className="border-b border-slate-200"><th className="text-left px-3 py-2">Slug</th><th className="text-left px-3 py-2">Nombre</th><th className="text-left px-3 py-2">Sede</th><th className="text-right px-3 py-2"># Activos</th></tr>
          </thead>
          <tbody>
            {items.map(l => (
              <tr key={l.slug} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500"><MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{l.slug}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{l.name}</td>
                <td className="px-3 py-2.5 text-sm font-mono text-slate-500">{l.siteCode}</td>
                <td className="px-3 py-2.5 text-right text-sm text-slate-700">{l.assetCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <NewLocationModal open={showNew} onClose={() => setShowNew(false)} onSaved={() => { reload(); setShowNew(false); }} />
    </div>
  );
}

function NewLocationModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ slug: '', name: '', siteCode: 'PE1H' });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  useEffect(() => { if (open) { setForm({ slug: '', name: '', siteCode: 'PE1H' }); setErr(null); } }, [open]);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await locationsApi.create(form); onSaved(); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nueva ubicación"
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={busy || !form.slug || !form.name} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Crear</button>
      </div>}>
      <div className="space-y-3">
        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>}
        <div><label className="text-xs font-medium text-slate-500">Slug *</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toUpperCase() })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" /></div>
        <div><label className="text-xs font-medium text-slate-500">Nombre *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
        <div><label className="text-xs font-medium text-slate-500">Sede</label><input value={form.siteCode} onChange={(e) => setForm({ ...form, siteCode: e.target.value.toUpperCase() })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" /></div>
      </div>
    </Modal>
  );
}

// ── Categorías ────────────────────────────────────────────────────────────────
function CategoriesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const reload = async () => { setLoading(true); setItems(await categoriesApi.list()); setLoading(false); };
  useEffect(() => { reload(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{items.length} categorías</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Nueva categoría
        </button>
      </div>
      {loading ? <p className="text-slate-400 py-6 text-center">Cargando…</p> : (
        <table className="w-full">
          <thead className="text-xs font-semibold text-slate-500 uppercase">
            <tr className="border-b border-slate-200"><th className="text-left px-3 py-2">Slug</th><th className="text-left px-3 py-2">Nombre</th><th className="text-left px-3 py-2">Prefijo TAG</th><th className="text-right px-3 py-2">Cant.</th><th className="text-left px-3 py-2 pl-6">Próximo TAG</th></tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.slug} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500"><Tag className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{c.slug}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{c.name}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{c.tagPrefix}</td>
                <td className="px-3 py-2.5 text-right text-sm text-slate-700">{c.assetCount}</td>
                <td className="px-3 py-2.5 pl-6 font-mono text-xs text-blue-600">{c.nextTag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <NewCategoryModal open={showNew} onClose={() => setShowNew(false)} onSaved={() => { reload(); setShowNew(false); }} />
    </div>
  );
}

function NewCategoryModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ slug: '', name: '', tagPrefix: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  useEffect(() => { if (open) { setForm({ slug: '', name: '', tagPrefix: '' }); setErr(null); } }, [open]);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await categoriesApi.create(form); onSaved(); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nueva categoría de activo"
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={busy || !form.slug || !form.name || !form.tagPrefix} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Crear</button>
      </div>}>
      <div className="space-y-3">
        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>}
        <div><label className="text-xs font-medium text-slate-500">Slug *</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" placeholder="ej. tablet" /></div>
        <div><label className="text-xs font-medium text-slate-500">Nombre *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
        <div><label className="text-xs font-medium text-slate-500">Prefijo TAG *</label><input value={form.tagPrefix} onChange={(e) => setForm({ ...form, tagPrefix: e.target.value.toUpperCase() })} placeholder="PE1H-IT-TAB-" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" /></div>
      </div>
    </Modal>
  );
}
