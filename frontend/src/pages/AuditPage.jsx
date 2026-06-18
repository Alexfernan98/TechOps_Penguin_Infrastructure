import { useEffect, useMemo, useState, useCallback } from 'react';
import { ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { auditApi } from '@/api/audit';
import { shortName } from '@/components/ui/Avatar';
import { AuditActionBadge } from '@/components/ui/Badge';
import { SortableTh, FilterSelect, ClearFiltersButton } from '@/components/ui/TableFilters';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE_LOGICAL', 'STATUS_CHANGE', 'ASSIGN', 'UNASSIGN', 'LOGIN', 'LOGOUT'];
const ENTITIES = ['Asset', 'User', 'Ticket', 'Acta', 'Department', 'Location', 'AssetCategory'];

function diffPreview(log) {
  const obj = log.after || log.before;
  if (!obj) return '—';
  try {
    const s = JSON.stringify(obj);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  } catch { return '—'; }
}

export default function AuditPage() {
  const [data, setData] = useState({ logs: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ entityType: '', action: '' });
  const [sort, setSort] = useState({ by: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);

  const toggleSort = (by) => setSort(s => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));
  const clearFilters = () => setF({ entityType: '', action: '' });

  const sortedLogs = useMemo(() => {
    const accessors = {
      createdAt:  l => l.createdAt ? new Date(l.createdAt).getTime() : 0,
      actor:      l => (l.user ? shortName(l.user) : 'Sistema').toLowerCase(),
      action:     l => l.action || '',
      entityType: l => l.entityType || '',
    };
    const getter = accessors[sort.by] || accessors.createdAt;
    return [...(data.logs || [])].sort((a, b) => {
      const av = getter(a); const bv = getter(b);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data.logs, sort]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, perPage: 50 };
      if (f.entityType) params.entityType = f.entityType;
      if (f.action) params.action = f.action;
      setData(await auditApi.list(params));
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, [f, page]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { setPage(1); }, [f]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Auditoría</h2>
        <p className="text-slate-500 mt-1">{data.pagination.total} eventos registrados</p>
      </div>

      <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">Bitácora inmutable · Toda acción sensible queda registrada · Solo lectura · Retención mínima 1 año.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect value={f.entityType} onChange={v => setF({ ...f, entityType: v })} placeholder="Toda entidad" options={ENTITIES.map(x => ({ value: x, label: x }))} />
        <FilterSelect value={f.action}     onChange={v => setF({ ...f, action: v })}     placeholder="Toda acción"   options={ACTIONS.map(x => ({ value: x, label: x }))} />
        <ClearFiltersButton onClick={clearFilters} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
              <SortableTh sort={sort} by="createdAt"  onClick={toggleSort}>Fecha</SortableTh>
              <SortableTh sort={sort} by="actor"      onClick={toggleSort}>Actor</SortableTh>
              <SortableTh sort={sort} by="action"     onClick={toggleSort}>Acción</SortableTh>
              <SortableTh sort={sort} by="entityType" onClick={toggleSort}>Entidad</SortableTh>
              <th className="px-4 py-3">Cambios</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>}
            {!loading && sortedLogs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Sin eventos</td></tr>}
            {!loading && sortedLogs.map(l => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-xs font-mono text-slate-500">{new Date(l.createdAt).toLocaleString('es-PY')}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{l.user ? shortName(l.user) : 'Sistema'}</td>
                <td className="px-4 py-3"><AuditActionBadge action={l.action} /></td>
                <td className="px-4 py-3 text-sm text-slate-600">{l.entityType} <span className="font-mono text-xs text-slate-400">{String(l.entityId).slice(0, 8)}</span></td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400 max-w-xs truncate">{diffPreview(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          <span>Página {data.pagination.page} de {data.pagination.totalPages || 1}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
