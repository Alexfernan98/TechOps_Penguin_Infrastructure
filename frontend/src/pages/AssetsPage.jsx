import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Upload, Download, ChevronRight, ChevronLeft, AlertTriangle, History, Camera, ScanLine, ExternalLink } from 'lucide-react';
import { SortableTh, FilterSelect, ClearFiltersButton } from '@/components/ui/TableFilters';
import toast from 'react-hot-toast';
import { assetsApi } from '@/api/assets';
import { actasApi } from '@/api/actas';
import { API_BASE } from '@/api/axios';
import { categoriesApi, locationsApi, departmentsApi } from '@/api/org';
import { usersApi } from '@/api/users';
import Drawer from '@/components/ui/Drawer';
import Modal from '@/components/ui/Modal';
import Avatar, { shortName } from '@/components/ui/Avatar';
import { AssetStatusBadge, ConditionText, ASSET_STATUS_LABEL, CONDITION_LABEL, AuditActionBadge } from '@/components/ui/Badge';
import BarcodeScanner from '@/components/ui/BarcodeScanner';
import UserPicker from '@/components/ui/UserPicker';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import useAuthStore from '@/store/authStore';
import { fieldsForCategory, showsField, domainOf, isAssignable, DOMAINS, CAMERA_TYPES, HA_MODES, roleOptions, importColumns, FIELD_LABELS, headerToKey } from '@/lib/categoryFields';

const STATUSES   = ['AVAILABLE', 'IN_PRODUCTION', 'ASSIGNED', 'LOAN', 'REPAIR', 'DAMAGED', 'RETIRED', 'LOST'];
const CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-PY') : '—';
const daysUntil = (d) => d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null;

function WarrantyCell({ until }) {
  if (!until) return <span className="text-slate-400">—</span>;
  const days = daysUntil(until);
  const cls = days < 0 ? 'text-rose-600' : days < 90 ? 'text-amber-600' : 'text-slate-600';
  return <span className={`text-sm ${cls}`}>{fmtDate(until)}{days < 90 && <span className="block text-xs">{days < 0 ? `vencida hace ${-days}d` : `${days}d`}</span>}</span>;
}

export default function AssetsPage() {
  const { user: me } = useAuthStore();
  const canWrite = ['IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN'].includes(me?.role);

  const [data, setData] = useState({ assets: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [cats, setCats]   = useState([]);
  const [locs, setLocs]   = useState([]);
  const [depts, setDepts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warranty, setWarranty] = useState({ assets: [], count: 0 });

  const [f, setF] = useState({ search: '', domain: '', category: '', status: '', condition: '', dept: '', location: '', user: '', onlyInactive: '' });
  const [sort, setSort] = useState({ by: 'tag', dir: 'asc' });
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Resuelve un código de barras escaneado: abre el drawer del activo o avisa si no existe.
  const onScanned = useCallback(async (code) => {
    setShowScanner(false);
    try {
      const asset = await assetsApi.byBarcode(code);
      setSelectedId(asset.id);
      toast.success(`Encontrado: ${asset.tag} (${asset.brand || ''} ${asset.model || ''})`.trim());
    } catch (e) {
      if (e.response?.status === 404) {
        toast.error(`No hay activo con código ${code}. Editá un activo y asignále este código.`, { duration: 6000 });
      } else {
        toast.error(e.response?.data?.error || e.message);
      }
    }
  }, []);

  const params = useMemo(() => {
    const p = { page, perPage: 15, sortBy: sort.by, sortDir: sort.dir };
    Object.entries(f).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [f, sort, page]);

  const reloadLists = useCallback(async () => {
    try {
      const [c, l, d, u, w] = await Promise.all([
        categoriesApi.list().catch(() => []),
        locationsApi.list().catch(() => []),
        departmentsApi.list().catch(() => []),
        usersApi.pick().catch(() => []),
        assetsApi.warrantyAlerts().catch(() => ({ assets: [], count: 0 })),
      ]);
      setCats(Array.isArray(c) ? c : []);
      setLocs(Array.isArray(l) ? l : []);
      setDepts(Array.isArray(d) ? d : []);
      setUsers(Array.isArray(u) ? u : []);
      setWarranty(w && typeof w === 'object' ? { assets: w.assets || [], count: w.count || 0 } : { assets: [], count: 0 });
    } catch (e) { /* catálogos opcionales */ }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await assetsApi.list(params);
      setData({
        assets: Array.isArray(d?.assets) ? d.assets : [],
        pagination: d?.pagination || { page: 1, perPage: 15, total: 0, totalPages: 1 },
      });
    }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, [params]);

  useEffect(() => { reloadLists(); }, [reloadLists]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { setPage(1); }, [f]);

  const toggleSort = (by) => setSort(s => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));
  const clearFilters = () => setF({ search: '', domain: '', category: '', status: '', condition: '', dept: '', location: '', user: '', onlyInactive: '' });

  const doExport = () => { window.open(`${API_BASE}${assetsApi.exportUrl(params)}`, '_blank'); };

  const onRefresh = () => { reload(); reloadLists(); };

  return (
    <div>
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Inventario de Activos</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">{data.pagination.total} activos registrados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowScanner(true)} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50" title="Buscar un activo escaneando su código de barras">
            <ScanLine className="w-4 h-4" /> Escanear
          </button>
          {canWrite && <>
            <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span></button>
            <button onClick={doExport} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"><Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span></button>
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"><Plus className="w-4 h-4" /> Nuevo activo</button>
          </>}
        </div>
      </div>

      {warranty.count > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">{warranty.count} garantías vencen en menos de 90 días</p>
            <p className="text-sm text-amber-700 mt-0.5">
              {warranty.assets.slice(0, 3).map(a => a.tag).join(' · ')}{warranty.count > 3 && ` + ${warranty.count - 3} más`}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={f.search} onChange={e => setF({ ...f, search: e.target.value })} placeholder="Buscar por TAG, marca, modelo, serial, usuario…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 md:flex md:flex-wrap items-stretch md:items-center gap-2">
          <FilterSelect value={f.domain}    onChange={v => setF({ ...f, domain: v, category: '' })} placeholder="Todos los dominios"    options={DOMAINS.map(d => ({ value: d.key, label: d.label }))} />
          <FilterSelect value={f.category}  onChange={v => setF({ ...f, category: v })}  placeholder="Todas las categorías"   options={cats.filter(c => !f.domain || domainOf(c.slug) === f.domain).map(c => ({ value: c.slug, label: c.name }))} />
          <FilterSelect value={f.status}    onChange={v => setF({ ...f, status: v })}    placeholder="Cualquier estado"       options={STATUSES.map(s => ({ value: s, label: ASSET_STATUS_LABEL[s] }))} />
          <FilterSelect value={f.condition} onChange={v => setF({ ...f, condition: v })} placeholder="Cualquier condición"    options={CONDITIONS.map(c => ({ value: c, label: CONDITION_LABEL[c] }))} />
          <FilterSelect value={f.dept}      onChange={v => setF({ ...f, dept: v })}      placeholder="Todos los departamentos" options={depts.map(d => ({ value: d.slug, label: d.name }))} />
          <FilterSelect value={f.location}  onChange={v => setF({ ...f, location: v })}  placeholder="Todas las ubicaciones"  options={locs.map(l => ({ value: l.slug, label: l.name }))} />
          <FilterSelect value={f.user}      onChange={v => setF({ ...f, user: v })}      placeholder="Cualquier usuario"      options={users.map(u => ({ value: u.id, label: shortName(u) }))} />
          <button
            onClick={() => setF({ ...f, onlyInactive: f.onlyInactive === 'true' ? '' : 'true' })}
            className={`col-span-2 md:col-auto px-3 py-2 text-sm font-medium rounded-lg ${
              f.onlyInactive === 'true'
                ? 'bg-amber-700 hover:bg-amber-800 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            Solo dados de baja{f.onlyInactive === 'true' ? ' ✓' : ''}
          </button>
          <ClearFiltersButton onClick={clearFilters} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
              <SortableTh sort={sort} by="tag"           onClick={toggleSort}>TAG</SortableTh>
              <SortableTh sort={sort} by="categorySlug"  onClick={toggleSort}>Categoría</SortableTh>
              <SortableTh sort={sort} by="brand"         onClick={toggleSort}>Marca / Modelo</SortableTh>
              <SortableTh sort={sort} by="serialNumber"  onClick={toggleSort}>Serial</SortableTh>
              <SortableTh sort={sort} by="status"        onClick={toggleSort}>Estado</SortableTh>
              <SortableTh sort={sort} by="condition"     onClick={toggleSort}>Condición</SortableTh>
              <th className="px-4 py-3">Asignado a</th>
              <SortableTh sort={sort} by="locationSlug"  onClick={toggleSort}>Ubicación</SortableTh>
              <SortableTh sort={sort} by="warrantyUntil" onClick={toggleSort}>Garantía</SortableTh>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>}
            {!loading && data.assets.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Sin resultados</td></tr>}
            {!loading && data.assets.map(a => (
              <tr key={a.id} onClick={() => setSelectedId(a.id)} className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${a.deletedAt ? 'opacity-60 bg-rose-50/30' : ''}`}>
                <td className="px-4 py-3 text-sm font-mono text-slate-700">{a.tag}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.category?.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{a.brand} <span className="text-slate-400">{a.model}</span></td>
                <td className="px-4 py-3 text-sm font-mono text-slate-500">{a.serialNumber || '—'}</td>
                <td className="px-4 py-3"><AssetStatusBadge status={a.status} /></td>
                <td className="px-4 py-3"><ConditionText condition={a.condition} /></td>
                <td className="px-4 py-3">{a.assignedTo ? (
                  <div className="flex items-center gap-2">
                    <Avatar user={a.assignedTo} size={26} />
                    <span className="text-sm text-slate-700">{shortName(a.assignedTo)}</span>
                    {a.shared && <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title={`Equipo compartido · ${(a.authorizedUsers || []).length + 1} usuarios`}>👥 +{(a.authorizedUsers || []).length}</span>}
                  </div>
                ) : <span className="text-slate-400 text-sm">{a.shared ? <span className="text-blue-600 text-xs">👥 Compartido (sin asignar)</span> : '—'}</span>}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.location?.name || '—'}</td>
                <td className="px-4 py-3"><WarrantyCell until={a.warrantyUntil} /></td>
                <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          <span>Mostrando {data.assets.length} de {data.pagination.total}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span>Página {data.pagination.page} de {data.pagination.totalPages || 1}</span>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {selectedId && <AssetDrawer id={selectedId} canWrite={canWrite} users={users} locs={locs} depts={depts} onClose={() => setSelectedId(null)} onRefresh={onRefresh} />}
      <NewAssetModal open={showNew} cats={cats} locs={locs} depts={depts} onClose={() => setShowNew(false)} onSaved={(a) => { setShowNew(false); onRefresh(); setSelectedId(a.id); }} />
      <ImportModal open={showImport} cats={cats} locs={locs} depts={depts} onClose={() => setShowImport(false)} onDone={onRefresh} />
      <BarcodeScanner open={showScanner} onDetect={onScanned} onClose={() => setShowScanner(false)} />
    </div>
  );
}

// ─── Drawer de detalle con 4 tabs ──────────────────────────────────────────────
function KV({ label, children }) {
  return <div className="flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="text-sm text-slate-800 text-right">{children ?? '—'}</dd></div>;
}

function AssetDrawer({ id, canWrite, users, locs, depts, onClose, onRefresh }) {
  const { user: me } = useAuthStore();
  const confirm = useConfirm();
  const canDelete = ['IT_ADMIN', 'SUPER_ADMIN'].includes(me?.role);
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('general');
  const [modal, setModal] = useState(null); // 'assign'|'return'|'status'|'retire'|'edit'
  const [pendingActa, setPendingActa] = useState(null);

  const load = useCallback(async () => {
    try { const d = await assetsApi.get(id); setAsset(d.asset); setHistory(d.history || []); }
    catch (e) { toast.error(e.response?.data?.error || e.message); onClose(); }
  }, [id, onClose]);
  useEffect(() => { load(); }, [load]);

  const hardDelete = async () => {
    const ok1 = await confirm({
      title: `¿Eliminar definitivamente ${asset.tag}?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok1) return;
    try {
      await assetsApi.remove(asset.id);
      toast.success(`Activo ${asset.tag} eliminado`);
      onRefresh(); onClose();
    } catch (e) {
      const data = e.response?.data;
      // Si el backend bloqueó por historial vinculado, ofrecemos el cascade.
      if (e.response?.status === 409 && data?.counts) {
        const parts = [];
        if (data.counts.assignments) parts.push(`${data.counts.assignments} asignación(es) histórica(s)`);
        if (data.counts.actas)       parts.push(`${data.counts.actas} acta(s) de entrega/devolución/baja`);
        if (data.counts.tickets)     parts.push(`${data.counts.tickets} ticket(s) (con comentarios y CSAT)`);
        const detail = parts.join('\n  • ');
        const ok = await confirm({
          title: `${asset.tag} tiene historial vinculado`,
          description:
            `  • ${detail}\n\n` +
            `Si continuás, se eliminará TODO lo anterior además del activo. ` +
            `Los snapshots quedan guardados en /audit para consulta posterior.`,
          confirmLabel: 'Eliminar todo',
          tone: 'danger',
        });
        if (!ok) {
          toast('Operación cancelada — usá "Dar de baja" para conservar el historial.', { icon: 'ℹ️' });
          return;
        }
        try {
          const r = await assetsApi.remove(asset.id, { cascade: true });
          const cleared = r.cleared || {};
          const summary = [
            cleared.assignments && `${cleared.assignments} asignación(es)`,
            cleared.actas && `${cleared.actas} acta(s)`,
            cleared.tickets && `${cleared.tickets} ticket(s)`,
          ].filter(Boolean).join(', ');
          toast.success(`Activo ${asset.tag} eliminado · removidos: ${summary || 'sin historial'}`, { duration: 6000 });
          onRefresh(); onClose();
        } catch (e2) {
          toast.error(e2.response?.data?.error || e2.message);
        }
        return;
      }
      // Otros errores
      const text = data?.error || e.message;
      toast.error(text, { duration: 6000 });
    }
  };

  if (!asset) return <Drawer open onClose={onClose} title="Cargando…" width={620}><p className="text-slate-400">Cargando…</p></Drawer>;

  const afterMutation = (actaSeed) => { load(); onRefresh(); setModal(null); if (actaSeed) setPendingActa(actaSeed); };
  // Solo activos de IT se entregan a funcionarios (assign / devolución / actas).
  // Networking / CCTV / DC son infraestructura: se ubican, no se asignan a personas.
  const assignable = isAssignable(asset.category?.slug || asset.categorySlug);

  return (
    <>
      <Drawer open onClose={onClose} width={640}
        title={<span className="font-mono">{asset.tag}</span>}
        subtitle={`${asset.brand || ''} ${asset.model || ''}`.trim()}
        footer={canWrite || canDelete ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {canWrite && asset.status !== 'RETIRED' && asset.status !== 'LOST' && <>
                <button onClick={() => setModal('edit')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">Editar</button>
                <button onClick={() => setModal('status')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Cambiar estado</button>
                {assignable && (asset.status === 'ASSIGNED'
                  ? <button onClick={() => setModal('return')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Devolver</button>
                  : <button onClick={() => setModal('assign')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Asignar</button>)}
                {assignable && <button onClick={() => setModal('legacy')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50" title="Registrar un acta que ya fue firmada antes de NetHub (solo se pega el link al PDF en Drive)">Acta legacy</button>}
              </>}
            </div>
            <div className="flex gap-2">
              {canWrite && asset.status !== 'RETIRED' && asset.status !== 'LOST' &&
                <button onClick={() => setModal('retire')} className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium rounded-lg hover:bg-rose-100">Dar de baja</button>}
              {canDelete && (asset.deletedAt || asset.status === 'RETIRED' || asset.status === 'LOST') &&
                <button onClick={() => setModal('restore')} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg" title="Revierte la baja y deja el activo disponible">Restaurar</button>}
              {canDelete &&
                <button onClick={hardDelete} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg" title="Borrado definitivo. Solo si no tiene historial.">Eliminar</button>}
            </div>
          </div>
        ) : null}
      >
        <div className="flex items-center gap-3 mb-4"><AssetStatusBadge status={asset.status} /><ConditionText condition={asset.condition} /></div>
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {[['general', 'General'], ['specs', 'Especificaciones'], ['history', 'Historial'], ['actas', 'Actas']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</button>
          ))}
        </div>

        {tab === 'general' && (
          <dl>
            <KV label="TAG"><span className="font-mono">{asset.tag}</span></KV>
            <KV label="Código de barras"><span className="font-mono">{asset.barcode || '—'}</span></KV>
            <KV label="Categoría">{asset.category?.name}</KV>
            <KV label="Marca / Modelo">{`${asset.brand || ''} ${asset.model || ''}`.trim() || '—'}</KV>
            <KV label="Estado">{ASSET_STATUS_LABEL[asset.status]}</KV>
            <KV label="Condición"><ConditionText condition={asset.condition} /></KV>
            {assignable && <KV label={asset.shared ? 'Responsable administrativo' : 'Asignado a'}>{asset.assignedTo ? shortName(asset.assignedTo) : '—'}</KV>}
            {assignable && asset.shared && (
              <KV label="Usuarios autorizados">
                {(asset.authorizedUsers || []).length === 0
                  ? <span className="text-slate-400">—</span>
                  : <div className="flex flex-wrap gap-1">{(asset.authorizedUsers || []).map(u => <span key={u.id} className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 border border-blue-200">{shortName(u)}</span>)}</div>}
              </KV>
            )}
            {assignable && asset.shared && <KV label="Modalidad"><span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">👥 Equipo compartido</span></KV>}
            {asset.internalCode    && <KV label="Código interno"><span className="font-mono">{asset.internalCode}</span></KV>}
            {asset.ipManagement    && <KV label="IP de gestión"><span className="font-mono">{asset.ipManagement}</span></KV>}
            {asset.cameraType      && <KV label="Tipo de cámara">{asset.cameraType}{asset.megapixels ? ` · ${asset.megapixels} MP` : ''}</KV>}
            {asset.nvrChannel      && <KV label="Canal NVR">{asset.nvrChannel}</KV>}
            {asset.ports != null   && <KV label="Puertos">{asset.ports}</KV>}
            {asset.role            && <KV label="Rol">{asset.role}</KV>}
            {asset.haMode          && <KV label="Modo HA">{asset.haMode}</KV>}
            {asset.haPeerAssetId   && <KV label="Peer HA"><span className="font-mono">{asset.haPeerAssetId}</span></KV>}
            {asset.displayLocation && <KV label="Ubicación física">{asset.displayLocation}</KV>}
            <KV label="Departamento">{depts.find(d => d.slug === asset.departmentSlug)?.name || '—'}</KV>
            <KV label="Ubicación">{asset.location?.name || '—'}</KV>
            <KV label="Fecha de compra">{fmtDate(asset.purchaseDate)}</KV>
            <KV label="Proveedor">{asset.vendor || '—'}</KV>
            <KV label="Garantía hasta"><WarrantyCell until={asset.warrantyUntil} /></KV>
            <KV label="Última revisión">{fmtDate(asset.lastRevisionDate)}</KV>
          </dl>
        )}
        {tab === 'specs' && (() => {
          const vis = fieldsForCategory(asset.category?.slug || asset.categorySlug);
          return (
          <dl>
            {vis.includes('serialNumber')    && <KV label="Número de serie"><span className="font-mono">{asset.serialNumber || '—'}</span></KV>}
            {vis.includes('imei')            && <KV label="IMEI"><span className="font-mono">{asset.imei || '—'}</span></KV>}
            {vis.includes('macWifi')         && <KV label="MAC WiFi"><span className="font-mono">{asset.macWifi || '—'}</span></KV>}
            {vis.includes('macEth')          && <KV label="MAC Ethernet"><span className="font-mono">{asset.macEth || '—'}</span></KV>}
            {vis.includes('operatingSystem') && <KV label="Sistema operativo">{asset.operatingSystem || '—'}</KV>}
            <KV label="Accesorios">{asset.accessories || '—'}</KV>
            <KV label="Evidencia">{asset.evidenceFolderUrl ? <a href={asset.evidenceFolderUrl} target="_blank" rel="noreferrer" className="text-blue-600">Abrir</a> : '—'}</KV>
            <div className="pt-3"><p className="text-sm text-slate-500 mb-1">Detalles</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{asset.details || '—'}</p></div>
            <div className="pt-3"><p className="text-sm text-slate-500 mb-1">Observaciones</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{asset.notes || '—'}</p></div>
          </dl>
          );
        })()}
        {tab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 && <p className="text-slate-400 text-sm">Sin eventos registrados.</p>}
            {history.map(h => (
              <div key={h.id} className="flex gap-3 text-sm">
                <History className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><AuditActionBadge action={h.action} /><span className="text-slate-500">{shortName(h.user)}</span></div>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(h.createdAt).toLocaleString('es-PY')}</p>
                  {h.after?.reason && <p className="text-xs text-slate-600 mt-1 italic">"{h.after.reason}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'actas' && (
          <div className="space-y-2">
            {(asset.actas || []).length === 0 && <p className="text-slate-400 text-sm">Sin actas vinculadas. Se generan al asignar, devolver o dar de baja.</p>}
            {(asset.actas || []).map(ac => {
              const ACTA_TYPE_LABEL = { DELIVERY: 'Entrega', RETURN: 'Devolución', RETIREMENT: 'Baja' };
              const TYPE_COLOR = { DELIVERY: 'bg-blue-50 text-blue-700 border-blue-200', RETURN: 'bg-violet-50 text-violet-700 border-violet-200', RETIREMENT: 'bg-rose-50 text-rose-700 border-rose-200' };
              const signed = ac.statusActa === 'signed';
              // Prioridad de link: Drive (legacy o firmada subida) > PDF generado
              const url = ac.signedDriveUrl || `${API_BASE}${actasApi.pdfUrl(ac.id)}`;
              return (
                <a key={ac.id} href={url} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${TYPE_COLOR[ac.type] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>{ACTA_TYPE_LABEL[ac.type] || ac.type}</span>
                      {ac.number && <span className="font-mono text-xs text-slate-600">{ac.number}</span>}
                      {ac.legacy && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-200 text-slate-600 uppercase tracking-wide">Legacy</span>}
                      <span className={`text-[11px] font-medium ${signed ? 'text-emerald-600' : 'text-amber-600'}`}>{signed ? 'Firmada' : 'Pendiente'}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {fmtDate(ac.signedAt)}
                      {ac.receptor && ac.type !== 'RETIREMENT' && <> · {shortName(ac.receptor)}</>}
                      {ac.tipoBaja && <> · <span className="font-mono">{ac.tipoBaja}</span></>}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                </a>
              );
            })}
          </div>
        )}
      </Drawer>

      {modal === 'edit'   && <EditAssetModal asset={asset} locs={locs} depts={depts} onClose={() => setModal(null)} onSaved={() => afterMutation()} />}
      {modal === 'assign' && <AssignModal asset={asset} users={users} depts={depts} onClose={() => setModal(null)} onDone={(uid, extra) => afterMutation({ type: 'DELIVERY', assetId: asset.id, receptorId: uid, conditionAfter: asset.condition, authorizedUsers: extra?.authorizedUsers })} />}
      {modal === 'return' && <ReturnModal asset={asset} onClose={() => setModal(null)} onDone={(cond, returnerId) => afterMutation({ type: 'RETURN', assetId: asset.id, receptorId: returnerId || asset.assignedTo?.id, conditionBefore: asset.condition, conditionAfter: cond })} />}
      {modal === 'status' && <StatusModal asset={asset} onClose={() => setModal(null)} onDone={() => afterMutation()} />}
      {modal === 'retire' && <RetireModal asset={asset} users={users} onClose={() => setModal(null)} onDone={(_assetStatus, reason, tipoBaja, userStatement, responsibleOperator) => afterMutation({ type: 'RETIREMENT', assetId: asset.id, tipoBaja, observations: reason, userStatement, responsibleOperator, conditionAfter: asset.condition })} />}
      {modal === 'legacy' && <LegacyActaModal asset={asset} users={users} onClose={() => setModal(null)} onSaved={() => afterMutation()} />}
      {modal === 'restore' && <RestoreModal asset={asset} onClose={() => setModal(null)} onDone={() => afterMutation()} />}
      {pendingActa && <ActaOfferModal seed={pendingActa} onClose={() => setPendingActa(null)} />}
    </>
  );
}

// ─── Modales ────────────────────────────────────────────────────────────────────
const inputCls = 'mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500';
const Field = ({ label, children }) => <div><label className="text-xs font-medium text-slate-500">{label}</label>{children}</div>;

// Campos extra de Networking / CCTV / DC. Renderiza solo los que `visible`
// incluye, leyendo/escribiendo en form/setForm. Compartido por New y Edit.
function ExtraFields({ form, setForm, visible, categorySlug }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const roles = roleOptions(categorySlug);
  return (
    <>
      {visible.includes('ipManagement')    && <Field label="IP de gestión"><input value={form.ipManagement || ''} onChange={set('ipManagement')} placeholder="10.0.0.1" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('ports')           && <Field label="N° de puertos"><input type="number" min="0" value={form.ports ?? ''} onChange={set('ports')} className={inputCls} /></Field>}
      {visible.includes('role')            && <Field label="Rol"><select value={form.role || ''} onChange={set('role')} className={inputCls}><option value="">—</option>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></Field>}
      {visible.includes('haMode')          && <Field label="Modo HA"><select value={form.haMode || ''} onChange={set('haMode')} className={inputCls}><option value="">—</option>{HA_MODES.map(m => <option key={m} value={m}>{m}</option>)}</select></Field>}
      {visible.includes('haPeerAssetId')   && <Field label="Peer HA (TAG del equipo)"><input value={form.haPeerAssetId || ''} onChange={set('haPeerAssetId')} placeholder="PE1H-NET-FW-002" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('cameraType')      && <Field label="Tipo de cámara"><select value={form.cameraType || ''} onChange={set('cameraType')} className={inputCls}><option value="">—</option>{CAMERA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>}
      {visible.includes('megapixels')      && <Field label="Megapíxeles"><input type="number" min="0" step="1" value={form.megapixels ?? ''} onChange={set('megapixels')} className={inputCls} /></Field>}
      {visible.includes('internalCode')    && <Field label="Código interno"><input value={form.internalCode || ''} onChange={set('internalCode')} placeholder="DC.H 120 / A11 / M14" className={`${inputCls} font-mono`} /></Field>}
      {visible.includes('nvrChannel')      && <Field label="Canal NVR"><input value={form.nvrChannel || ''} onChange={set('nvrChannel')} placeholder="D1 / Surveillance" className={inputCls} /></Field>}
      {visible.includes('displayLocation') && <div className="col-span-2"><Field label="Ubicación física (descripción)"><input value={form.displayLocation || ''} onChange={set('displayLocation')} placeholder="PTZ Caseta Mara2 / Comedor Central-1" className={inputCls} /></Field></div>}
    </>
  );
}

// Input numérico de 6 dígitos con botón "Escanear" al lado. Pad-zero al blur.
function BarcodeField({ value, onChange }) {
  const [scan, setScan] = useState(false);
  const onBlur = () => {
    if (!value) return;
    const digits = String(value).replace(/\D/g, '');
    if (digits) onChange(digits.padStart(6, '0').slice(-6));
  };
  return (
    <>
      <div className="mt-1 flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onBlur={onBlur}
          placeholder="000700"
          inputMode="numeric"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
        />
        <button type="button" onClick={() => setScan(true)} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5" title="Escanear con la cámara">
          <Camera className="w-4 h-4" /> Escanear
        </button>
      </div>
      <BarcodeScanner open={scan} onClose={() => setScan(false)} onDetect={(code) => { onChange(code); setScan(false); }} />
    </>
  );
}

function NewAssetModal({ open, cats, locs, depts, onClose, onSaved }) {
  const empty = { categorySlug: '', barcode: '', brand: '', model: '', serialNumber: '', operatingSystem: '', macWifi: '', macEth: '', imei: '', status: 'AVAILABLE', condition: 'GOOD', locationSlug: '', departmentSlug: '', purchaseDate: '', warrantyUntil: '', vendor: '', details: '', shared: false, ipManagement: '', internalCode: '', nvrChannel: '', cameraType: '', megapixels: '', ports: '', role: '', haMode: '', haPeerAssetId: '', displayLocation: '' };
  const [form, setForm] = useState(empty);
  const [nextTag, setNextTag] = useState('');
  const [busy, setBusy] = useState(false);
  const visible = fieldsForCategory(form.categorySlug);

  useEffect(() => { if (open) { setForm(empty); setNextTag(''); } }, [open]);
  useEffect(() => { if (form.categorySlug) assetsApi.nextTag(form.categorySlug).then(setNextTag).catch(() => setNextTag('')); }, [form.categorySlug]);

  const submit = async () => {
    setBusy(true);
    try { const a = await assetsApi.create(form); toast.success(`Activo ${a.tag} creado`); onSaved(a); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo activo" width={640}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !form.categorySlug} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Crear activo</button></div>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría *"><select value={form.categorySlug} onChange={e => { const cs = e.target.value; setForm({ ...form, categorySlug: cs, status: isAssignable(cs) ? 'AVAILABLE' : 'IN_PRODUCTION' }); }} className={inputCls}><option value="">Seleccionar…</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
        <Field label="TAG (auto)"><input value={nextTag} readOnly className={`${inputCls} bg-slate-50 font-mono`} placeholder="—" /></Field>
        <div className="col-span-2">
          <Field label="Código de barras (opcional · 6 dígitos)">
            <BarcodeField value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
          </Field>
        </div>
        {visible.includes('brand')           && <Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className={inputCls} /></Field>}
        {visible.includes('model')           && <Field label="Modelo"><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={inputCls} /></Field>}
        {visible.includes('serialNumber')    && <Field label="Número de serie"><input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className={`${inputCls} font-mono`} /></Field>}
        {visible.includes('imei')            && <Field label="IMEI"><input value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} className={`${inputCls} font-mono`} /></Field>}
        {visible.includes('operatingSystem') && <Field label="Sistema operativo"><input value={form.operatingSystem} onChange={e => setForm({ ...form, operatingSystem: e.target.value })} className={inputCls} /></Field>}
        {visible.includes('macWifi')         && <Field label="MAC WiFi"><input value={form.macWifi} onChange={e => setForm({ ...form, macWifi: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" className={`${inputCls} font-mono`} /></Field>}
        {visible.includes('macEth')          && <Field label="MAC Ethernet"><input value={form.macEth} onChange={e => setForm({ ...form, macEth: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" className={`${inputCls} font-mono`} /></Field>}
        <ExtraFields form={form} setForm={setForm} visible={visible} categorySlug={form.categorySlug} />
        <Field label="Estado inicial"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>{(isAssignable(form.categorySlug) ? ['AVAILABLE', 'REPAIR', 'DAMAGED', 'LOAN'] : ['IN_PRODUCTION', 'AVAILABLE', 'REPAIR', 'DAMAGED']).map(s => <option key={s} value={s}>{ASSET_STATUS_LABEL[s]}</option>)}</select></Field>
        <Field label="Condición"><select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className={inputCls}>{CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select></Field>
        <Field label="Ubicación"><select value={form.locationSlug} onChange={e => setForm({ ...form, locationSlug: e.target.value })} className={inputCls}><option value="">—</option>{locs.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select></Field>
        <Field label="Departamento"><select value={form.departmentSlug} onChange={e => setForm({ ...form, departmentSlug: e.target.value })} className={inputCls}><option value="">—</option>{depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></Field>
        <Field label="Fecha de compra"><input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className={inputCls} /></Field>
        <Field label="Garantía hasta"><input type="date" value={form.warrantyUntil} onChange={e => setForm({ ...form, warrantyUntil: e.target.value })} className={inputCls} /></Field>
        <div className="col-span-2"><Field label="Proveedor"><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputCls} /></Field></div>
        <div className="col-span-2"><Field label="Detalles / Specs"><textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={2} className={inputCls} /></Field></div>
        {isAssignable(form.categorySlug) && (
          <div className="col-span-2">
            <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={form.shared} onChange={e => setForm({ ...form, shared: e.target.checked })} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">Equipo compartido entre varios usuarios</p>
                <p className="text-xs text-slate-500">Útil para PCs del NOC, equipos de turno rotativo, etc. Permite asignar múltiples usuarios simultáneamente bajo un responsable principal.</p>
              </div>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditAssetModal({ asset, locs, depts, onClose, onSaved }) {
  const catSlug = asset.categorySlug || asset.category?.slug;
  const [form, setForm] = useState({ barcode: asset.barcode || '', brand: asset.brand || '', model: asset.model || '', serialNumber: asset.serialNumber || '', operatingSystem: asset.operatingSystem || '', macWifi: asset.macWifi || '', macEth: asset.macEth || '', imei: asset.imei || '', locationSlug: asset.locationSlug || '', departmentSlug: asset.departmentSlug || '', vendor: asset.vendor || '', warrantyUntil: asset.warrantyUntil ? asset.warrantyUntil.slice(0, 10) : '', details: asset.details || '', notes: asset.notes || '', shared: asset.shared === true, ipManagement: asset.ipManagement || '', internalCode: asset.internalCode || '', nvrChannel: asset.nvrChannel || '', cameraType: asset.cameraType || '', megapixels: asset.megapixels ?? '', ports: asset.ports ?? '', role: asset.role || '', haMode: asset.haMode || '', haPeerAssetId: asset.haPeerAssetId || '', displayLocation: asset.displayLocation || '' });
  const visible = fieldsForCategory(catSlug);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await assetsApi.update(asset.id, form); toast.success('Activo actualizado'); onSaved(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Editar ${asset.tag}`} width={620}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Guardar</button></div>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Código de barras (opcional · 6 dígitos)">
            <BarcodeField value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
          </Field>
        </div>
        {visible.includes('brand')           && <Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className={inputCls} /></Field>}
        {visible.includes('model')           && <Field label="Modelo"><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={inputCls} /></Field>}
        {visible.includes('serialNumber')    && <Field label="Número de serie"><input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className={`${inputCls} font-mono`} /></Field>}
        {visible.includes('imei')            && <Field label="IMEI"><input value={form.imei} onChange={e => setForm({ ...form, imei: e.target.value })} className={`${inputCls} font-mono`} /></Field>}
        {visible.includes('operatingSystem') && <Field label="Sistema operativo"><input value={form.operatingSystem} onChange={e => setForm({ ...form, operatingSystem: e.target.value })} className={inputCls} /></Field>}
        {visible.includes('macWifi')         && <Field label="MAC WiFi"><input value={form.macWifi} onChange={e => setForm({ ...form, macWifi: e.target.value })} className={`${inputCls} font-mono`} /></Field>}
        {visible.includes('macEth')          && <Field label="MAC Ethernet"><input value={form.macEth} onChange={e => setForm({ ...form, macEth: e.target.value })} className={`${inputCls} font-mono`} /></Field>}
        <ExtraFields form={form} setForm={setForm} visible={visible} categorySlug={catSlug} />
        <Field label="Ubicación"><select value={form.locationSlug} onChange={e => setForm({ ...form, locationSlug: e.target.value })} className={inputCls}><option value="">—</option>{locs.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select></Field>
        <Field label="Departamento"><select value={form.departmentSlug} onChange={e => setForm({ ...form, departmentSlug: e.target.value })} className={inputCls}><option value="">—</option>{depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></Field>
        <Field label="Proveedor"><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputCls} /></Field>
        <Field label="Garantía hasta"><input type="date" value={form.warrantyUntil} onChange={e => setForm({ ...form, warrantyUntil: e.target.value })} className={inputCls} /></Field>
        <div className="col-span-2"><Field label="Detalles"><textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={2} className={inputCls} /></Field></div>
        <div className="col-span-2"><Field label="Observaciones"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></Field></div>
        {isAssignable(catSlug) && (
          <div className="col-span-2">
            <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={form.shared} onChange={e => setForm({ ...form, shared: e.target.checked })} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">Equipo compartido entre varios usuarios</p>
                <p className="text-xs text-slate-500">Permite asignar múltiples usuarios simultáneamente bajo un responsable principal (ej. PC del NOC).</p>
              </div>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AssignModal({ asset, users, depts, onClose, onDone }) {
  const isShared = asset.shared === true;
  const initialPrimary = asset.assignedTo?.id || '';
  const initialAuthorized = (asset.authorizedUsers || []).map(u => u.id);

  const [userId, setUserId] = useState(initialPrimary);
  const [authorizedUserIds, setAuthorizedUserIds] = useState(initialAuthorized);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const target = users.find(u => u.id === userId);
  const authorizedUsers = authorizedUserIds.map(id => users.find(u => u.id === id)).filter(Boolean);

  const toggleAuthorized = (uid) => {
    if (uid === userId) return; // el primary no puede estar como secundario
    setAuthorizedUserIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = isShared
        ? { userId, notes, isPrimary: true, authorizedUserIds }
        : { userId, notes };
      await assetsApi.assign(asset.id, body);
      toast.success(isShared ? 'Asignación de equipo compartido actualizada' : 'Activo asignado');
      // El callback espera (uid, extra) — extra incluye authorizedUsers para el acta.
      const authForActa = isShared
        ? authorizedUsers.map(u => ({ id: u.id, name: u.name, ci: u.ci || null }))
        : [];
      onDone(userId, { authorizedUsers: authForActa });
    }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  const missingCi = isShared ? authorizedUsers.some(u => !u.ci) || (target && !target.ci) : (target && !target.ci);

  return (
    <Modal open onClose={onClose} title={`${isShared ? 'Asignar equipo compartido' : 'Asignar'} ${asset.tag}`} width={isShared ? 640 : 480}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !userId} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">{isShared ? 'Guardar asignaciones' : 'Asignar'}</button></div>}>
      <div className="space-y-3">
        {isShared && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <strong>Equipo compartido.</strong> Elegí un responsable administrativo (firma el acta de entrega) y los usuarios autorizados a operar el equipo.
          </div>
        )}
        <Field label={isShared ? 'Responsable principal (firma el acta)' : 'Empleado'}>
          <UserPicker users={users} value={userId} onChange={setUserId} requireCi />
        </Field>
        {target && !target.ci && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">Para emitir el acta, el responsable debe tener CI cargada en Usuarios.</div>}

        {isShared && (
          <Field label={`Usuarios autorizados (${authorizedUsers.length})`}>
            <div className="mt-1 max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {users.filter(u => u.isActive !== false).map(u => {
                const checked = authorizedUserIds.includes(u.id);
                const isPrimary = u.id === userId;
                return (
                  <label key={u.id} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${isPrimary ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input type="checkbox" disabled={isPrimary} checked={checked} onChange={() => toggleAuthorized(u.id)} />
                    <span className="flex-1">{u.name}</span>
                    {isPrimary && <span className="text-[10px] uppercase font-semibold text-blue-600">Responsable</span>}
                    {!u.ci && <span className="text-[10px] uppercase font-semibold text-amber-600">Sin CI</span>}
                  </label>
                );
              })}
            </div>
          </Field>
        )}
        {missingCi && isShared && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">Algunos usuarios autorizados no tienen CI cargada — su nombre aparecerá en el acta sin CI.</div>}
        <Field label="Observaciones"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} /></Field>
      </div>
    </Modal>
  );
}

function ReturnModal({ asset, onClose, onDone }) {
  const isShared = asset.shared === true;
  // Para shared damos a elegir quién devuelve (puede ser un autorizado, no necesariamente el primary).
  const tenedores = [
    ...(asset.assignedTo ? [{ ...asset.assignedTo, role: 'Responsable administrativo' }] : []),
    ...((asset.authorizedUsers || []).map(u => ({ ...u, role: 'Usuario autorizado' }))),
  ];
  const [condition, setCondition] = useState(asset.condition || 'GOOD');
  const [notes, setNotes] = useState('');
  const [returnerId, setReturnerId] = useState(isShared ? '' : (asset.assignedTo?.id || ''));
  const [returnAll, setReturnAll] = useState(!isShared);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      // En shared: si returnAll, no mandamos userId (devuelve todas). Si no, mandamos el userId del que devuelve.
      const body = { condition, notes };
      if (isShared && !returnAll && returnerId) body.userId = returnerId;
      await assetsApi.unassign(asset.id, body);
      toast.success('Activo devuelto');
      // El acta se emite a nombre del que devuelve (returnerId) — o del primary si returnAll.
      onDone(condition, isShared && !returnAll ? returnerId : asset.assignedTo?.id);
    }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  const disabled = busy || (isShared && !returnAll && !returnerId);

  return (
    <Modal open onClose={onClose} title={`Devolver ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={disabled} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Confirmar devolución</button></div>}>
      <div className="space-y-3">
        {!isShared && <p className="text-sm text-slate-600">Receptor actual: <strong>{shortName(asset.assignedTo)}</strong></p>}
        {isShared && (
          <>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <strong>Equipo compartido.</strong> Indicá si devuelve un usuario específico (acta a su nombre) o si se devuelven todas las asignaciones del equipo.
            </div>
            <Field label="¿Qué devolución es?">
              <div className="mt-1 flex gap-2 flex-wrap text-xs">
                <button type="button" onClick={() => setReturnAll(false)} className={`px-3 py-1.5 rounded-full border ${!returnAll ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Un usuario específico</button>
                <button type="button" onClick={() => { setReturnAll(true); setReturnerId(''); }} className={`px-3 py-1.5 rounded-full border ${returnAll ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Todas las asignaciones</button>
              </div>
            </Field>
            {!returnAll && (
              <Field label="Persona que devuelve (firma el acta) *">
                <select value={returnerId} onChange={e => setReturnerId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar…</option>
                  {tenedores.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                </select>
              </Field>
            )}
          </>
        )}
        <Field label="Condición al devolver"><select value={condition} onChange={e => setCondition(e.target.value)} className={inputCls}>{CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select></Field>
        <Field label="Observaciones (daños, accesorios)"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} /></Field>
      </div>
    </Modal>
  );
}

function StatusModal({ asset, onClose, onDone }) {
  const [status, setStatus] = useState('REPAIR');
  const [condition, setCondition] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const opts = ['REPAIR', 'DAMAGED', 'LOAN', 'AVAILABLE', 'IN_PRODUCTION'];
  const submit = async () => {
    setBusy(true);
    try { await assetsApi.changeStatus(asset.id, { status, condition: condition || undefined, reason }); toast.success('Estado actualizado'); onDone(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Cambiar estado · ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !reason} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Aplicar</button></div>}>
      <div className="space-y-3">
        <Field label="Estado actual"><input value={ASSET_STATUS_LABEL[asset.status]} readOnly className={`${inputCls} bg-slate-50`} /></Field>
        <Field label="Nuevo estado"><select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>{opts.map(s => <option key={s} value={s}>{ASSET_STATUS_LABEL[s]}</option>)}</select></Field>
        <Field label="Nueva condición (opcional)"><select value={condition} onChange={e => setCondition(e.target.value)} className={inputCls}><option value="">Sin cambio</option>{CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select></Field>
        <Field label="Motivo *"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputCls} placeholder="Obligatorio" /></Field>
      </div>
    </Modal>
  );
}

// Sub-tipos de baja del acta (metadata.tipoBaja). Mapean a un status final del Asset:
//   DAMAGE  → DAMAGED (en el activo) — pasa a RETIRED si es irreparable
//   THEFT   → LOST    (robo)
//   LOSS    → LOST    (extravío)
//   OBSOLETE→ RETIRED (fin de vida útil)
const TIPO_BAJA_OPTIONS = [
  { value: 'DAMAGE',   label: 'Daño irreparable',     assetStatus: 'RETIRED' },
  { value: 'THEFT',    label: 'Robo',                 assetStatus: 'LOST'    },
  { value: 'LOSS',     label: 'Extravío',             assetStatus: 'LOST'    },
  { value: 'OBSOLETE', label: 'Obsoleto / Fin de vida', assetStatus: 'RETIRED' },
];

function RetireModal({ asset, users = [], onClose, onDone }) {
  const [tipoBaja, setTipoBaja] = useState('OBSOLETE');
  const [reason, setReason] = useState('');
  const [userStatement, setUserStatement] = useState('');
  const [operatorMode, setOperatorMode] = useState('otro'); // otro | ninguno
  const [operatorId, setOperatorId] = useState('');
  const [operatorStatement, setOperatorStatement] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = TIPO_BAJA_OPTIONS.find(o => o.value === tipoBaja) || TIPO_BAJA_OPTIONS[0];
  const requiereDeclaracion = ['DAMAGE', 'THEFT', 'LOSS'].includes(tipoBaja);
  const isShared = asset.shared === true;
  const requiereOperador = isShared && requiereDeclaracion;
  // Candidatos: primary + autorizados (los que tenían acceso al equipo).
  const candidatos = [
    ...(asset.assignedTo ? [{ ...asset.assignedTo, role: 'Responsable administrativo' }] : []),
    ...((asset.authorizedUsers || []).map(u => ({ ...u, role: 'Usuario autorizado' }))),
  ];
  // Si no hay operador (modo ninguno), no se manda nada. Si modo otro, se permite cualquier user.
  const operatorEffectiveId = operatorMode === 'ninguno' ? '' : operatorId;

  const submit = async () => {
    setBusy(true);
    try {
      await assetsApi.retire(asset.id, { status: selected.assetStatus, reason });
      toast.success('Activo dado de baja');
      onDone(
        selected.assetStatus, reason, tipoBaja,
        requiereDeclaracion ? userStatement : null,
        requiereOperador && operatorEffectiveId ? { userId: operatorEffectiveId, statement: operatorStatement } : null,
      );
    }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  // Operador es opcional ahora: si modo=ninguno, no se requiere id/statement.
  const operatorOk = !requiereOperador
    || operatorMode === 'ninguno'
    || (operatorEffectiveId && operatorStatement);
  const disabled = busy || !reason
    || (requiereDeclaracion && !userStatement)
    || !operatorOk;
  return (
    <Modal open onClose={onClose} title={`Dar de baja · ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={disabled} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Confirmar baja</button></div>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">La baja es <strong>lógica</strong>: el registro se conserva con su historial. Nunca se borra físicamente.</div>
        <Field label="Tipo de baja">
          <select value={tipoBaja} onChange={e => setTipoBaja(e.target.value)} className={inputCls}>
            {TIPO_BAJA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate-400 -mt-1">Estado final del activo: <span className="font-mono font-medium">{selected.assetStatus}</span></p>
        <Field label="Motivo / Observaciones IT *"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Detalle del incidente, número de denuncia si aplica, fecha aproximada..." /></Field>
        {requiereDeclaracion && (
          <>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Este tipo de baja requiere la <strong>firma del {isShared ? 'responsable administrativo' : 'usuario responsable'}</strong>. La declaración aparecerá en el acta junto a las firmas {isShared ? '(IT + Responsable administrativo + Operador del incidente)' : '(IT + Usuario)'}.
            </div>
            <Field label={`Declaración del ${isShared ? 'responsable administrativo' : 'usuario responsable'} *`}><textarea value={userStatement} onChange={e => setUserStatement(e.target.value)} rows={3} className={inputCls} placeholder="Explicación de lo ocurrido (será firmada en el acta)..." /></Field>
          </>
        )}
        {requiereOperador && (
          <>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <strong>Equipo compartido.</strong> Identificá al operador específico responsable directo del incidente — su firma aparecerá en el acta como tercer firmante. Si no se pudo identificar, podés dejarlo en blanco.
            </div>
            <Field label="¿Quién fue el responsable del incidente?">
              <div className="mt-1 flex gap-2 flex-wrap text-xs">
                {[
                  { v: 'otro',    t: 'Seleccionar persona' },
                  { v: 'ninguno', t: 'No identificado' },
                ].map(o => (
                  <button key={o.v} type="button"
                    onClick={() => { setOperatorMode(o.v); setOperatorId(''); }}
                    className={`px-3 py-1.5 rounded-full border ${operatorMode === o.v ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {o.t}
                  </button>
                ))}
              </div>
            </Field>
            {operatorMode === 'otro' && (
              <Field label="Persona responsable *">
                <UserPicker users={users} value={operatorId} onChange={setOperatorId} requireCi />
              </Field>
            )}
            {operatorMode !== 'ninguno' && (
              <Field label="Declaración del operador *"><textarea value={operatorStatement} onChange={e => setOperatorStatement(e.target.value)} rows={3} className={inputCls} placeholder="Qué pasó exactamente según el operador (será firmada en el acta)..." /></Field>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function RestoreModal({ asset, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await assetsApi.restore(asset.id, { reason }); toast.success('Activo restaurado'); onDone(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Restaurar · ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !reason.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Restaurar activo</button></div>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          Vas a revertir la baja de <strong>{asset.tag}</strong>. El activo volverá al estado <span className="font-mono">AVAILABLE</span> y aparecerá nuevamente en el listado activo.
        </div>
        <Field label="Motivo de la restauración *">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Ej. La baja fue registrada por error / El equipo fue recuperado tras el robo / Se confirmó que era reparable…" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}

function LegacyActaModal({ asset, users, onClose, onSaved }) {
  // Registra un acta firmada FUERA del sistema (antes del despliegue de NetHub).
  // Solo guarda el link al PDF original en Drive — no genera nada.
  const [type, setType] = useState('DELIVERY');
  const [receptorId, setReceptorId] = useState(asset.assignedTo?.id || '');
  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10));
  const [signedDriveUrl, setSignedDriveUrl] = useState('');
  const [observations, setObservations] = useState('');
  const [tipoBaja, setTipoBaja] = useState('OBSOLETE');
  const [busy, setBusy] = useState(false);

  const driveOk = /^https?:\/\/(drive|docs)\.google\.com\//i.test(signedDriveUrl);
  const needsReceptor = type !== 'RETIREMENT';
  const disabled = busy || !signedAt || !signedDriveUrl || !driveOk || (needsReceptor && !receptorId);

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        type, assetId: asset.id, signedAt, signedDriveUrl, observations,
        receptorId: needsReceptor ? receptorId : undefined,
        tipoBaja:   type === 'RETIREMENT' ? tipoBaja : undefined,
        conditionAfter: asset.condition,
      };
      const a = await actasApi.createLegacy(body);
      toast.success(`Acta legacy ${a.number} registrada`);
      onSaved(a);
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Registrar acta firmada (legacy) · ${asset.tag}`} width={620}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={disabled} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Registrar</button></div>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Este formulario es para actas <strong>firmadas antes de NetHub</strong>. No se genera PDF — solo se enlaza al PDF original en Drive. Quedará marcada con el badge <strong>Legacy</strong>.
        </div>
        <Field label="Tipo de acta">
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
            <option value="DELIVERY">Entrega</option>
            <option value="RETURN">Devolución</option>
            <option value="RETIREMENT">Baja</option>
          </select>
        </Field>
        {needsReceptor && (
          <Field label="Receptor *"><UserPicker users={users} value={receptorId} onChange={setReceptorId} /></Field>
        )}
        {type === 'RETIREMENT' && (
          <Field label="Tipo de baja">
            <select value={tipoBaja} onChange={e => setTipoBaja(e.target.value)} className={inputCls}>
              {TIPO_BAJA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Fecha original de la firma *">
          <input type="date" value={signedAt} onChange={e => setSignedAt(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Link al PDF firmado en Drive *">
          <input value={signedDriveUrl} onChange={e => setSignedDriveUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../view" className={`${inputCls} font-mono text-xs`} />
        </Field>
        {signedDriveUrl && !driveOk && <p className="text-xs text-rose-600 -mt-2">El link debe apuntar a drive.google.com o docs.google.com.</p>}
        <Field label="Observaciones (opcional)">
          <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} className={inputCls} placeholder="Notas sobre esta acta histórica..." />
        </Field>
      </div>
    </Modal>
  );
}

function ActaOfferModal({ seed, onClose }) {
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [err, setErr] = useState(null);
  const TYPE_LABEL = { DELIVERY: 'entrega', RETURN: 'devolución', RETIREMENT: 'baja' };
  const generate = async () => {
    setBusy(true); setErr(null);
    try { const a = await actasApi.create(seed); setCreated(a); toast.success(`Acta ${a.number} generada`); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Generar acta de ${TYPE_LABEL[seed.type]}`}
      footer={created
        ? <div className="flex justify-end gap-2"><a href="/actas" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">Ir a Actas</a><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button></div>
        : <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Omitir</button><button onClick={generate} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Generar acta</button></div>}>
      {created
        ? <p className="text-sm text-slate-600">Acta <strong className="font-mono">{created.number}</strong> creada en estado pendiente de firma. Imprimila y subí la versión firmada desde el módulo Actas.</p>
        : <>
            <p className="text-sm text-slate-600">¿Querés generar el acta de {TYPE_LABEL[seed.type]} para documentar esta operación?</p>
            {err && <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>}
          </>}
    </Modal>
  );
}

// ─── ImportModal (importación masiva de activos, por categoría) ────────────────
// Parser CSV con soporte de campos entre comillas ("a,b") y delimitador , o ;.
function parseCsvLine(line, delim = ',') {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

// Construye el spec de columnas de la plantilla para una categoría, con las
// opciones de dropdown de cada columna restringida. Fuente única de verdad de
// qué es lista y qué valores tiene — se usa para generar la plantilla y para
// mapear los encabezados al importar el .xlsx.
function templateColumns(slug, locs, depts) {
  return importColumns(slug).map(key => {
    const label = FIELD_LABELS[key] || key;
    let options;
    if (key === 'status')        options = (isAssignable(slug) ? ['AVAILABLE', 'REPAIR', 'DAMAGED', 'LOAN'] : ['IN_PRODUCTION', 'AVAILABLE', 'REPAIR', 'DAMAGED']).map(v => ASSET_STATUS_LABEL[v]);
    else if (key === 'condition')       options = CONDITIONS.map(c => CONDITION_LABEL[c]);
    else if (key === 'cameraType')      options = CAMERA_TYPES;
    else if (key === 'role')            options = roleOptions(slug);
    else if (key === 'haMode')          options = HA_MODES;
    else if (key === 'locationSlug')    options = (locs || []).map(l => l.name);
    else if (key === 'departmentSlug')  options = (depts || []).map(d => d.name);
    return options && options.length ? { key, label, options } : { key, label };
  });
}

function ImportModal({ open, cats = [], locs = [], depts = [], onClose, onDone }) {
  const [category, setCategory] = useState('');
  const [text, setText]   = useState('');
  const [file, setFile]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr]     = useState(null);

  useEffect(() => { if (open) { setText(''); setFile(null); setResult(null); setErr(null); setCategory(''); } }, [open]);

  const catName = cats.find(c => c.slug === category)?.name;
  const columns = category ? templateColumns(category, locs, depts) : [];

  const downloadTemplate = async () => {
    if (!category) return;
    setErr(null);
    try {
      const blob = await assetsApi.importTemplate(`plantilla_${category}`, columns);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `plantilla_${category}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setErr('No se pudo generar la plantilla: ' + (e.response?.data?.error || e.message)); }
  };

  // CSV robusto: detecta delimitador (, o ;) y mapea encabezados → claves.
  const parseCsv = (raw) => {
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = (line) => parseCsvLine(line, delim);
    const headers = split(lines[0]).map(headerToKey);
    return lines.slice(1).map(line => {
      const cells = split(line);
      const row = {};
      headers.forEach((h, i) => { if (h) row[h] = cells[i] ?? ''; });
      return row;
    });
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    if (/\.xlsx$/i.test(f.name)) { setFile(f); setText(''); }
    else { // csv / texto
      setFile(null);
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result || ''));
      reader.readAsText(f, 'utf-8');
    }
  };

  const submit = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      if (!category) throw new Error('Elegí el tipo de activo primero.');
      let r;
      if (file) {
        r = await assetsApi.importFile(file, columns, category);
      } else {
        const rows = parseCsv(text);
        if (rows.length === 0) throw new Error('No se detectaron filas (verificá encabezados + al menos una fila).');
        r = await assetsApi.import(rows, category);
      }
      setResult(r);
      toast.success(`Import OK: ${r.created || 0} creados · ${r.updated || 0} actualizados`);
      onDone?.();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  const canProcess = !!category && (!!file || !!text.trim());

  return (
    <Modal open={open} onClose={onClose} title="Importar activos" width={720}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
          {!result && <button onClick={submit} disabled={busy || !canProcess} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">{busy ? 'Procesando…' : 'Procesar'}</button>}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <strong>1.</strong> Elegí el tipo de activo y <strong>descargá la plantilla Excel</strong> — trae listas desplegables en Estado, Condición, Tipo, Ubicación, etc. <strong>2.</strong> Completá en Excel (dejá <strong>TAG vacío</strong> para que se autogenere el correlativo). <strong>3.</strong> Subí el mismo <code className="text-xs">.xlsx</code>.
          <br />Si el TAG existe se <strong>actualiza</strong>; si va vacío o es nuevo se <strong>crea</strong>. Cada fila queda en auditoría.
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="Tipo de activo *">
            <select value={category} onChange={e => { setCategory(e.target.value); setFile(null); setText(''); }} className={inputCls}>
              <option value="">Seleccionar…</option>
              {cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <button onClick={downloadTemplate} disabled={!category} className="px-3 py-2 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap">
            <Download className="w-4 h-4" /> Descargar plantilla Excel
          </button>
        </div>

        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 whitespace-pre-wrap">{err}</div>}

        {result ? (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <p className="font-medium">Importación completada</p>
            <ul className="mt-2 space-y-0.5 text-emerald-700">
              <li>Creados: <strong>{result.created || 0}</strong></li>
              <li>Actualizados: <strong>{result.updated || 0}</strong></li>
              <li>Omitidos: <strong>{result.skipped || 0}</strong></li>
              {Array.isArray(result.errors) && result.errors.length > 0 && (
                <li className="text-rose-700">Errores: <strong>{result.errors.length}</strong></li>
              )}
            </ul>
            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <ul className="mt-2 text-xs text-rose-600 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 20).map((er, i) => <li key={i}>Fila {er.row + 1}: {er.error}</li>)}
              </ul>
            )}
          </div>
        ) : category ? (
          <>
            <Field label="Subir archivo (.xlsx o .csv)">
              <input type="file" accept=".xlsx,.csv,text/csv" onChange={onFile} className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              {file && <p className="mt-1 text-xs text-emerald-600">Archivo Excel listo: <strong>{file.name}</strong></p>}
            </Field>
            <Field label="…o pegá contenido CSV (avanzado)">
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); if (e.target.value) setFile(null); }}
                rows={6}
                placeholder="TAG,Marca,Modelo,...&#10;,Hikvision,DS-2CD...,..."
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
          </>
        ) : (
          <p className="text-sm text-slate-400">Elegí un tipo de activo para empezar.</p>
        )}
      </div>
    </Modal>
  );
}
