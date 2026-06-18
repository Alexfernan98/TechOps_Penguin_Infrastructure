import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, LayoutGrid, List, Star, Lock } from 'lucide-react';
import { SortableTh, FilterSelect, ClearFiltersButton } from '@/components/ui/TableFilters';
import toast from 'react-hot-toast';
import { ticketsApi } from '@/api/tickets';
import { assetsApi } from '@/api/assets';
import { usersApi } from '@/api/users';
import Drawer from '@/components/ui/Drawer';
import Modal from '@/components/ui/Modal';
import Avatar, { shortName } from '@/components/ui/Avatar';
import {
  PriorityBadge, TicketStatusBadge, SlaBadge, PRIORITY_LABEL, PRIORITY_BORDER,
  TICKET_STATUS_LABEL, TICKET_CATEGORY_LABEL,
} from '@/components/ui/Badge';
import useAuthStore from '@/store/authStore';

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES   = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];
const CATEGORIES = ['TECH_SUPPORT', 'EQUIPMENT_REQUEST', 'ACCESS_PERMISSIONS', 'CONNECTIVITY', 'SOFTWARE', 'SECURITY', 'OTHER'];
const KANBAN = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED'];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-PY') : '—';

export default function TicketsPage() {
  const { user: me } = useAuthStore();
  const isTech = ['IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN'].includes(me?.role);

  const [tickets, setTickets] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [f, setF] = useState({ search: '', status: '', priority: '', assigneeId: '' });
  const [sort, setSort] = useState({ by: 'createdAt', dir: 'desc' });
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setTickets(await ticketsApi.list()); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (isTech) usersApi.pick().then(u => setTechs(u.filter(x => ['IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN'].includes(x.role)))).catch(() => {}); }, [isTech]);

  const filtered = useMemo(() => {
    const list = tickets.filter(t => {
      if (f.status && t.status !== f.status) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.assigneeId && t.assignedToId !== f.assigneeId) return false;
      if (f.search) { const s = f.search.toLowerCase(); if (![t.number, t.title].some(v => (v || '').toLowerCase().includes(s))) return false; }
      return true;
    });
    const accessors = {
      number:      t => t.number || '',
      title:       t => (t.title || '').toLowerCase(),
      priority:    t => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(t.priority),
      status:      t => (t.status || ''),
      createdBy:   t => (shortName(t.createdBy) || '').toLowerCase(),
      assignedTo:  t => (shortName(t.assignedTo) || '~').toLowerCase(),
      sla:         t => t.sla?.dueAt ? new Date(t.sla.dueAt).getTime() : Infinity,
      createdAt:   t => t.createdAt ? new Date(t.createdAt).getTime() : 0,
    };
    const getter = accessors[sort.by] || accessors.createdAt;
    return [...list].sort((a, b) => {
      const av = getter(a); const bv = getter(b);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tickets, f, sort]);

  const toggleSort = (by) => setSort(s => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));
  const clearFilters = () => setF({ search: '', status: '', priority: '', assigneeId: '' });

  const kpis = useMemo(() => ({
    open: tickets.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'REOPENED'].includes(t.status)).length,
    critical: tickets.filter(t => t.priority === 'CRITICAL' && !['CLOSED', 'RESOLVED', 'CANCELLED'].includes(t.status)).length,
    breached: tickets.filter(t => t.sla?.color === 'rose').length,
  }), [tickets]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tickets</h2>
          <p className="text-slate-500 mt-1">{tickets.length} tickets</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"><Plus className="w-4 h-4" /> Nuevo ticket</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {[['Abiertos', kpis.open, 'text-blue-600'], ['Críticos vivos', kpis.critical, 'text-rose-600'], ['SLA vencido', kpis.breached, 'text-amber-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{l}</p><p className={`text-2xl font-bold mt-1 ${c}`}>{v}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={f.search} onChange={e => setF({ ...f, search: e.target.value })} placeholder="Buscar por N° o título…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <FilterSelect value={f.status}     onChange={v => setF({ ...f, status: v })}     placeholder="Cualquier estado"    options={STATUSES.map(s => ({ value: s, label: TICKET_STATUS_LABEL[s] }))} />
        <FilterSelect value={f.priority}   onChange={v => setF({ ...f, priority: v })}   placeholder="Cualquier prioridad" options={PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        {isTech && <FilterSelect value={f.assigneeId} onChange={v => setF({ ...f, assigneeId: v })} placeholder="Cualquier técnico" options={techs.map(t => ({ value: t.id, label: shortName(t) }))} />}
        <ClearFiltersButton onClick={clearFilters} />
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setView('list')} className={`px-3 py-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
          <button onClick={() => setView('kanban')} className={`px-3 py-2 ${view === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? <p className="text-slate-400 text-center py-10">Cargando…</p>
        : view === 'list' ? <TicketTable tickets={filtered} sort={sort} toggleSort={toggleSort} onSelect={setSelectedId} />
        : <TicketKanban tickets={filtered} onSelect={setSelectedId} />}

      {selectedId && <TicketDrawer id={selectedId} me={me} isTech={isTech} techs={techs} onClose={() => setSelectedId(null)} onRefresh={reload} />}
      <NewTicketModal open={showNew} isTech={isTech} techs={techs} onClose={() => setShowNew(false)} onSaved={(t) => { setShowNew(false); reload(); setSelectedId(t.id); }} />
    </div>
  );
}

function TicketTable({ tickets, sort, toggleSort, onSelect }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
            <SortableTh sort={sort} by="number"     onClick={toggleSort}>N°</SortableTh>
            <SortableTh sort={sort} by="title"      onClick={toggleSort}>Título</SortableTh>
            <SortableTh sort={sort} by="priority"   onClick={toggleSort}>Prioridad</SortableTh>
            <SortableTh sort={sort} by="status"     onClick={toggleSort}>Estado</SortableTh>
            <SortableTh sort={sort} by="createdBy"  onClick={toggleSort}>Solicitante</SortableTh>
            <SortableTh sort={sort} by="assignedTo" onClick={toggleSort}>Técnico</SortableTh>
            <SortableTh sort={sort} by="sla"        onClick={toggleSort}>SLA</SortableTh>
            <SortableTh sort={sort} by="createdAt"  onClick={toggleSort}>Creado</SortableTh>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Sin tickets</td></tr>}
          {tickets.map(t => (
            <tr key={t.id} onClick={() => onSelect(t.id)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
              <td className="px-4 py-3 text-sm font-mono text-slate-700">{t.number}</td>
              <td className="px-4 py-3"><p className="text-sm font-medium text-slate-800">{t.title}</p><p className="text-xs text-slate-400">{TICKET_CATEGORY_LABEL[t.category]}</p></td>
              <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
              <td className="px-4 py-3"><TicketStatusBadge status={t.status} /></td>
              <td className="px-4 py-3 text-sm text-slate-600">{shortName(t.createdBy)}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{t.assignedTo ? shortName(t.assignedTo) : <span className="text-slate-400">—</span>}</td>
              <td className="px-4 py-3"><SlaBadge sla={t.sla} /></td>
              <td className="px-4 py-3 text-sm text-slate-500">{fmtDate(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketKanban({ tickets, onSelect }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN.map(status => {
        const col = tickets.filter(t => t.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-2 px-1"><span className="text-sm font-semibold text-slate-600">{TICKET_STATUS_LABEL[status]}</span><span className="text-xs text-slate-400">{col.length}</span></div>
            <div className="space-y-2">
              {col.map(t => (
                <div key={t.id} onClick={() => onSelect(t.id)} className={`bg-white rounded-lg border-l-4 ${PRIORITY_BORDER[t.priority]} border border-slate-200 p-3 cursor-pointer hover:shadow-sm`}>
                  <p className="text-xs font-mono text-slate-400">{t.number}</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5 line-clamp-2">{t.title}</p>
                  <div className="flex items-center justify-between mt-2"><SlaBadge sla={t.sla} />{t.assignedTo && <span className="text-xs text-slate-500">{t.assignedTo.nameFirst?.split(' ')[0] || shortName(t.assignedTo)}</span>}</div>
                </div>
              ))}
              {col.length === 0 && <p className="text-xs text-slate-300 px-1">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TicketDrawer({ id, me, isTech, techs, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await ticketsApi.get(id)); }
    catch (e) { toast.error(e.response?.data?.error || e.message); onClose(); }
  }, [id, onClose]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Drawer open onClose={onClose} title="Cargando…" width={620}><p className="text-slate-400">Cargando…</p></Drawer>;
  const t = data.ticket;
  const isRequester = t.createdById === me?.id;

  const sendComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try { await ticketsApi.comment(id, { body: comment, isInternal: internal }); setComment(''); setInternal(false); await load(); onRefresh(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  const changeStatus = async (status) => { try { await ticketsApi.changeStatus(id, status); await load(); onRefresh(); toast.success('Estado actualizado'); } catch (e) { toast.error(e.response?.data?.error || e.message); } };
  const assign = async (uid) => { try { await ticketsApi.assign(id, uid || null); await load(); onRefresh(); } catch (e) { toast.error(e.response?.data?.error || e.message); } };
  const rate = async (score) => { try { await ticketsApi.csat(id, { score }); await load(); onRefresh(); toast.success('¡Gracias por tu calificación!'); } catch (e) { toast.error(e.response?.data?.error || e.message); } };

  return (
    <Drawer open onClose={onClose} width={620}
      title={<span className="font-mono">{t.number}</span>} subtitle={t.title}
      footer={isTech ? (
        <div className="flex items-center gap-2">
          <select value={t.status} onChange={e => changeStatus(e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}
          </select>
          <select value={t.assignedToId || ''} onChange={e => assign(e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">— Sin técnico —</option>
            {techs.map(tc => <option key={tc.id} value={tc.id}>{shortName(tc)}</option>)}
          </select>
        </div>
      ) : null}
    >
      <div className="flex items-center gap-2 mb-4"><PriorityBadge priority={t.priority} /><TicketStatusBadge status={t.status} /><SlaBadge sla={t.sla} /></div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div><p className="text-xs text-slate-400">Solicitante</p><p className="text-slate-700">{shortName(t.createdBy)}</p></div>
        <div><p className="text-xs text-slate-400">Técnico</p><p className="text-slate-700">{t.assignedTo ? shortName(t.assignedTo) : '—'}</p></div>
        <div><p className="text-xs text-slate-400">Categoría</p><p className="text-slate-700">{TICKET_CATEGORY_LABEL[t.category]}</p></div>
        <div><p className="text-xs text-slate-400">Vence</p><p className="text-slate-700">{t.dueAt ? new Date(t.dueAt).toLocaleString('es-PY') : '—'}</p></div>
      </div>

      <section className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Descripción</h3>
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{t.description}</p>
      </section>

      {t.status === 'RESOLVED' && isRequester && !t.csat && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-sm font-medium text-emerald-800 mb-2">¿Cómo fue la atención? Calificá del 1 al 5</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => rate(n)} className="w-9 h-9 rounded-lg bg-white border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center"><Star className="w-4 h-4 text-emerald-600" /><span className="sr-only">{n}</span></button>)}
          </div>
        </div>
      )}
      {t.csat && <div className="mb-4 text-sm text-slate-500">Calificación: {'★'.repeat(t.csat.score)}{'☆'.repeat(5 - t.csat.score)}</div>}

      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Conversación</h3>
        <div className="space-y-3 mb-4">
          {(t.comments || []).length === 0 && <p className="text-slate-400 text-sm">Sin comentarios aún.</p>}
          {(t.comments || []).map(c => (
            <div key={c.id} className={`p-3 rounded-lg ${c.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Avatar user={c.author} size={22} />
                <span className="text-sm font-medium text-slate-700">{shortName(c.author)}</span>
                {c.isInternal && <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold"><Lock className="w-3 h-3" /> NOTA INTERNA</span>}
                <span className="text-xs text-slate-400 ml-auto">{new Date(c.createdAt).toLocaleString('es-PY')}</span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Escribí un comentario…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
          <div className="flex items-center justify-between">
            {isTech ? <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> Nota interna</label> : <span />}
            <button onClick={sendComment} disabled={busy || !comment.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Comentar</button>
          </div>
        </div>
      </section>
    </Drawer>
  );
}

function NewTicketModal({ open, isTech, techs, onClose, onSaved }) {
  const empty = { title: '', description: '', priority: 'MEDIUM', category: 'TECH_SUPPORT', assignedToId: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm(empty); }, [open]);

  const submit = async () => {
    setBusy(true);
    try { const t = await ticketsApi.create({ ...form, assignedToId: form.assignedToId || undefined }); toast.success(`Ticket ${t.number} creado`); onSaved(t); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nuevo ticket"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy || !form.title || !form.description} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Crear ticket</button></div>}>
      <div className="space-y-3">
        <div><label className="text-xs font-medium text-slate-500">Título *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
        <div><label className="text-xs font-medium text-slate-500">Descripción *</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-slate-500">Prioridad</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">{PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
          <div><label className="text-xs font-medium text-slate-500">Categoría</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{TICKET_CATEGORY_LABEL[c]}</option>)}</select></div>
        </div>
        {isTech && <div><label className="text-xs font-medium text-slate-500">Asignar a (opcional)</label><select value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">— Sin asignar —</option>{techs.map(t => <option key={t.id} value={t.id}>{shortName(t)}</option>)}</select></div>}
      </div>
    </Modal>
  );
}
