import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Upload, Download, ChevronRight, ChevronLeft, AlertTriangle, History, ArrowUpDown, Camera, ScanLine } from 'lucide-react';
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

const STATUSES   = ['AVAILABLE', 'ASSIGNED', 'LOAN', 'REPAIR', 'DAMAGED', 'RETIRED', 'LOST'];
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

  const [f, setF] = useState({ search: '', category: '', status: '', condition: '', dept: '', location: '', user: '' });
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
  const clearFilters = () => setF({ search: '', category: '', status: '', condition: '', dept: '', location: '', user: '' });

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
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="w-full md:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Categoría</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="w-full md:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Estado</option>{STATUSES.map(s => <option key={s} value={s}>{ASSET_STATUS_LABEL[s]}</option>)}</select>
          <select value={f.condition} onChange={e => setF({ ...f, condition: e.target.value })} className="w-full md:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Condición</option>{CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select>
          <select value={f.dept} onChange={e => setF({ ...f, dept: e.target.value })} className="w-full md:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Departamento</option>{depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select>
          <select value={f.location} onChange={e => setF({ ...f, location: e.target.value })} className="w-full md:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Ubicación</option>{locs.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select>
          <select value={f.user} onChange={e => setF({ ...f, user: e.target.value })} className="w-full md:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Usuario</option>{users.map(u => <option key={u.id} value={u.id}>{shortName(u)}</option>)}</select>
          <button onClick={clearFilters} className="col-span-2 md:col-auto px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Limpiar</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('tag')}><span className="inline-flex items-center gap-1">TAG <ArrowUpDown className="w-3 h-3" /></span></th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('brand')}><span className="inline-flex items-center gap-1">Marca / Modelo <ArrowUpDown className="w-3 h-3" /></span></th>
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Condición</th>
              <th className="px-4 py-3">Asignado a</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Garantía</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>}
            {!loading && data.assets.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Sin resultados</td></tr>}
            {!loading && data.assets.map(a => (
              <tr key={a.id} onClick={() => setSelectedId(a.id)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3 text-sm font-mono text-slate-700">{a.tag}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.category?.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{a.brand} <span className="text-slate-400">{a.model}</span></td>
                <td className="px-4 py-3 text-sm font-mono text-slate-500">{a.serialNumber || '—'}</td>
                <td className="px-4 py-3"><AssetStatusBadge status={a.status} /></td>
                <td className="px-4 py-3"><ConditionText condition={a.condition} /></td>
                <td className="px-4 py-3">{a.assignedTo ? <div className="flex items-center gap-2"><Avatar user={a.assignedTo} size={26} /><span className="text-sm text-slate-700">{shortName(a.assignedTo)}</span></div> : <span className="text-slate-400 text-sm">—</span>}</td>
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
      <ImportModal open={showImport} onClose={() => setShowImport(false)} onDone={onRefresh} />
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
                {asset.status === 'ASSIGNED'
                  ? <button onClick={() => setModal('return')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Devolver</button>
                  : <button onClick={() => setModal('assign')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Asignar</button>}
              </>}
            </div>
            <div className="flex gap-2">
              {canWrite && asset.status !== 'RETIRED' && asset.status !== 'LOST' &&
                <button onClick={() => setModal('retire')} className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium rounded-lg hover:bg-rose-100">Dar de baja</button>}
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
            <KV label="Asignado a">{asset.assignedTo ? shortName(asset.assignedTo) : '—'}</KV>
            <KV label="Departamento">{depts.find(d => d.slug === asset.departmentSlug)?.name || '—'}</KV>
            <KV label="Ubicación">{asset.location?.name || '—'}</KV>
            <KV label="Fecha de compra">{fmtDate(asset.purchaseDate)}</KV>
            <KV label="Proveedor">{asset.vendor || '—'}</KV>
            <KV label="Garantía hasta"><WarrantyCell until={asset.warrantyUntil} /></KV>
            <KV label="Última revisión">{fmtDate(asset.lastRevisionDate)}</KV>
          </dl>
        )}
        {tab === 'specs' && (
          <dl>
            <KV label="Número de serie"><span className="font-mono">{asset.serialNumber || '—'}</span></KV>
            <KV label="IMEI"><span className="font-mono">{asset.imei || '—'}</span></KV>
            <KV label="MAC WiFi"><span className="font-mono">{asset.macWifi || '—'}</span></KV>
            <KV label="MAC Ethernet"><span className="font-mono">{asset.macEth || '—'}</span></KV>
            <KV label="Sistema operativo">{asset.operatingSystem || '—'}</KV>
            <KV label="Accesorios">{asset.accessories || '—'}</KV>
            <KV label="Evidencia">{asset.evidenceFolderUrl ? <a href={asset.evidenceFolderUrl} target="_blank" rel="noreferrer" className="text-blue-600">Abrir</a> : '—'}</KV>
            <div className="pt-3"><p className="text-sm text-slate-500 mb-1">Detalles</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{asset.details || '—'}</p></div>
            <div className="pt-3"><p className="text-sm text-slate-500 mb-1">Observaciones</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{asset.notes || '—'}</p></div>
          </dl>
        )}
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
            {(asset.actas || []).map(ac => (
              <a key={ac.id} href={`${API_BASE}${actasApi.pdfUrl(ac.id)}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">
                <span>{ac.type} · {fmtDate(ac.signedAt)}</span><ChevronRight className="w-4 h-4 text-slate-300" />
              </a>
            ))}
          </div>
        )}
      </Drawer>

      {modal === 'edit'   && <EditAssetModal asset={asset} locs={locs} depts={depts} onClose={() => setModal(null)} onSaved={() => afterMutation()} />}
      {modal === 'assign' && <AssignModal asset={asset} users={users} depts={depts} onClose={() => setModal(null)} onDone={(uid) => afterMutation({ type: 'DELIVERY', assetId: asset.id, receptorId: uid, conditionAfter: asset.condition })} />}
      {modal === 'return' && <ReturnModal asset={asset} onClose={() => setModal(null)} onDone={(cond) => afterMutation({ type: 'RETURN', assetId: asset.id, receptorId: asset.assignedTo?.id, conditionBefore: asset.condition, conditionAfter: cond })} />}
      {modal === 'status' && <StatusModal asset={asset} onClose={() => setModal(null)} onDone={() => afterMutation()} />}
      {modal === 'retire' && <RetireModal asset={asset} onClose={() => setModal(null)} onDone={(_assetStatus, reason, tipoBaja) => afterMutation({ type: 'RETIREMENT', assetId: asset.id, tipoBaja, observations: reason, conditionAfter: asset.condition })} />}
      {pendingActa && <ActaOfferModal seed={pendingActa} onClose={() => setPendingActa(null)} />}
    </>
  );
}

// ─── Modales ────────────────────────────────────────────────────────────────────
const inputCls = 'mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500';
const Field = ({ label, children }) => <div><label className="text-xs font-medium text-slate-500">{label}</label>{children}</div>;

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
  const empty = { categorySlug: '', barcode: '', brand: '', model: '', serialNumber: '', operatingSystem: '', macWifi: '', macEth: '', status: 'AVAILABLE', condition: 'GOOD', locationSlug: '', departmentSlug: '', purchaseDate: '', warrantyUntil: '', vendor: '', details: '' };
  const [form, setForm] = useState(empty);
  const [nextTag, setNextTag] = useState('');
  const [busy, setBusy] = useState(false);

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
        <Field label="Categoría *"><select value={form.categorySlug} onChange={e => setForm({ ...form, categorySlug: e.target.value })} className={inputCls}><option value="">Seleccionar…</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
        <Field label="TAG (auto)"><input value={nextTag} readOnly className={`${inputCls} bg-slate-50 font-mono`} placeholder="—" /></Field>
        <div className="col-span-2">
          <Field label="Código de barras (opcional · 6 dígitos)">
            <BarcodeField value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
          </Field>
        </div>
        <Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className={inputCls} /></Field>
        <Field label="Modelo"><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={inputCls} /></Field>
        <Field label="Número de serie"><input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        <Field label="Sistema operativo"><input value={form.operatingSystem} onChange={e => setForm({ ...form, operatingSystem: e.target.value })} className={inputCls} /></Field>
        <Field label="MAC WiFi"><input value={form.macWifi} onChange={e => setForm({ ...form, macWifi: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" className={`${inputCls} font-mono`} /></Field>
        <Field label="MAC Ethernet"><input value={form.macEth} onChange={e => setForm({ ...form, macEth: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" className={`${inputCls} font-mono`} /></Field>
        <Field label="Estado inicial"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>{['AVAILABLE', 'REPAIR', 'DAMAGED', 'LOAN'].map(s => <option key={s} value={s}>{ASSET_STATUS_LABEL[s]}</option>)}</select></Field>
        <Field label="Condición"><select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className={inputCls}>{CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select></Field>
        <Field label="Ubicación"><select value={form.locationSlug} onChange={e => setForm({ ...form, locationSlug: e.target.value })} className={inputCls}><option value="">—</option>{locs.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select></Field>
        <Field label="Departamento"><select value={form.departmentSlug} onChange={e => setForm({ ...form, departmentSlug: e.target.value })} className={inputCls}><option value="">—</option>{depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></Field>
        <Field label="Fecha de compra"><input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className={inputCls} /></Field>
        <Field label="Garantía hasta"><input type="date" value={form.warrantyUntil} onChange={e => setForm({ ...form, warrantyUntil: e.target.value })} className={inputCls} /></Field>
        <div className="col-span-2"><Field label="Proveedor"><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputCls} /></Field></div>
        <div className="col-span-2"><Field label="Detalles / Specs"><textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={2} className={inputCls} /></Field></div>
      </div>
    </Modal>
  );
}

function EditAssetModal({ asset, locs, depts, onClose, onSaved }) {
  const [form, setForm] = useState({ barcode: asset.barcode || '', brand: asset.brand || '', model: asset.model || '', serialNumber: asset.serialNumber || '', operatingSystem: asset.operatingSystem || '', macWifi: asset.macWifi || '', macEth: asset.macEth || '', locationSlug: asset.locationSlug || '', departmentSlug: asset.departmentSlug || '', vendor: asset.vendor || '', warrantyUntil: asset.warrantyUntil ? asset.warrantyUntil.slice(0, 10) : '', details: asset.details || '', notes: asset.notes || '' });
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
        <Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className={inputCls} /></Field>
        <Field label="Modelo"><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={inputCls} /></Field>
        <Field label="Número de serie"><input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        <Field label="Sistema operativo"><input value={form.operatingSystem} onChange={e => setForm({ ...form, operatingSystem: e.target.value })} className={inputCls} /></Field>
        <Field label="MAC WiFi"><input value={form.macWifi} onChange={e => setForm({ ...form, macWifi: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        <Field label="MAC Ethernet"><input value={form.macEth} onChange={e => setForm({ ...form, macEth: e.target.value })} className={`${inputCls} font-mono`} /></Field>
        <Field label="Ubicación"><select value={form.locationSlug} onChange={e => setForm({ ...form, locationSlug: e.target.value })} className={inputCls}><option value="">—</option>{locs.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}</select></Field>
        <Field label="Departamento"><select value={form.departmentSlug} onChange={e => setForm({ ...form, departmentSlug: e.target.value })} className={inputCls}><option value="">—</option>{depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></Field>
        <Field label="Proveedor"><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputCls} /></Field>
        <Field label="Garantía hasta"><input type="date" value={form.warrantyUntil} onChange={e => setForm({ ...form, warrantyUntil: e.target.value })} className={inputCls} /></Field>
        <div className="col-span-2"><Field label="Detalles"><textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={2} className={inputCls} /></Field></div>
        <div className="col-span-2"><Field label="Observaciones"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></Field></div>
      </div>
    </Modal>
  );
}

function AssignModal({ asset, users, depts, onClose, onDone }) {
  const [userId, setUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const target = users.find(u => u.id === userId);
  const submit = async () => {
    setBusy(true);
    try { await assetsApi.assign(asset.id, { userId, notes }); toast.success('Activo asignado'); onDone(userId); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Asignar ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !userId} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Asignar</button></div>}>
      <div className="space-y-3">
        <Field label="Empleado">
          <UserPicker users={users} value={userId} onChange={setUserId} requireCi />
        </Field>
        {target && !target.ci && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">Para emitir el acta de entrega, el empleado debe tener CI cargada en Usuarios.</div>}
        <Field label="Observaciones"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} /></Field>
      </div>
    </Modal>
  );
}

function ReturnModal({ asset, onClose, onDone }) {
  const [condition, setCondition] = useState(asset.condition || 'GOOD');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await assetsApi.unassign(asset.id, { condition, notes }); toast.success('Activo devuelto'); onDone(condition); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Devolver ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Confirmar devolución</button></div>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Receptor actual: <strong>{shortName(asset.assignedTo)}</strong></p>
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
  const opts = ['REPAIR', 'DAMAGED', 'LOAN', 'AVAILABLE'];
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

function RetireModal({ asset, onClose, onDone }) {
  const [tipoBaja, setTipoBaja] = useState('OBSOLETE');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = TIPO_BAJA_OPTIONS.find(o => o.value === tipoBaja) || TIPO_BAJA_OPTIONS[0];

  const submit = async () => {
    setBusy(true);
    try {
      // El backend de /retire espera status (RETIRED/LOST). Lo derivamos del tipoBaja.
      await assetsApi.retire(asset.id, { status: selected.assetStatus, reason });
      toast.success('Activo dado de baja');
      onDone(selected.assetStatus, reason, tipoBaja);
    }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Dar de baja · ${asset.tag}`}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !reason} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Confirmar baja</button></div>}>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">La baja es <strong>lógica</strong>: el registro se conserva con su historial. Nunca se borra físicamente.</div>
        <Field label="Tipo de baja">
          <select value={tipoBaja} onChange={e => setTipoBaja(e.target.value)} className={inputCls}>
            {TIPO_BAJA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate-400 -mt-1">Estado final del activo: <span className="font-mono font-medium">{selected.assetStatus}</span></p>
        <Field label="Motivo / Observaciones *"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Detalle del incidente, número de denuncia si aplica, fecha aproximada..." /></Field>
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

// ─── ImportModal (importación masiva de activos por CSV) ───────────────────────
function ImportModal({ open, onClose, onDone }) {
  const [text, setText]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr]     = useState(null);

  useEffect(() => { if (open) { setText(''); setResult(null); setErr(null); } }, [open]);

  const parseCsv = (raw) => {
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      return row;
    });
  };

  const submit = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error('No se detectaron filas (verificá que el CSV tenga encabezados y datos).');
      const r = await assetsApi.import(rows);
      setResult(r);
      toast.success(`Import OK: ${r.created || 0} creados · ${r.updated || 0} actualizados`);
      onDone?.();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importar activos (CSV)" width={680}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
          {!result && <button onClick={submit} disabled={busy || !text.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Procesar CSV</button>}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          Si el <strong>TAG</strong> existe, se <strong>actualiza</strong>. Si no existe, se <strong>crea</strong>.
          Se validan TAG único, SN único y formato de MAC. Cada fila genera un evento de auditoría.
          <br /><br />
          Columnas reconocidas: <code className="text-xs font-mono">tag, categorySlug, brand, model, serialNumber, macWifi, macEth, operatingSystem, status, condition, departmentSlug, locationSlug, vendor, purchaseDate, warrantyUntil, details, notes</code>.
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
                <li className="text-rose-700">Errores: <strong>{result.errors.length}</strong> (revisar logs)</li>
              )}
            </ul>
          </div>
        ) : (
          <Field label="Pegá acá el contenido del CSV (con encabezados en la primera fila)">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder="tag,categorySlug,brand,model,serialNumber,...&#10;PE1H-IT-PC-100,desktop,Dell,Optiplex,SN123,..."
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
