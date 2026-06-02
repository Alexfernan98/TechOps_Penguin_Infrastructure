import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { usersApi } from '@/api/users';
import { departmentsApi } from '@/api/org';
import Drawer from '@/components/ui/Drawer';
import Modal from '@/components/ui/Modal';
import Avatar, { shortName } from '@/components/ui/Avatar';
import { RoleBadge } from '@/components/ui/Badge';
import useAuthStore from '@/store/authStore';

const ROLES = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_TECH', 'EMPLOYEE', 'READ_ONLY'];

function deptName(slug, depts) {
  return depts.find(d => d.slug === slug)?.name || slug || '—';
}

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [selected, setSelected]     = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([usersApi.list(), departmentsApi.list()]);
      setUsers(Array.isArray(u) ? u : []); setDepts(Array.isArray(d) ? d : []); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (deptFilter && u.departmentSlug !== deptFilter) return false;
      if (activeFilter === 'active' && !u.isActive) return false;
      if (activeFilter === 'inactive' && u.isActive) return false;
      if (search) {
        const s = search.toLowerCase();
        if (![u.name, u.email, u.ci].some(v => (v || '').toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, deptFilter, activeFilter]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
          <p className="text-slate-500 mt-1">{users.length} registrados · {users.filter(u=>u.isActive).length} activos</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <UserPlus className="w-4 h-4" /> Invitar usuario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, CI..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Todos los departamentos</option>
          {depts.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Activos e inactivos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">CI</th>
              <th className="px-4 py-3">Última sesión</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Sin resultados</td></tr>}
            {!loading && filtered.map(u => (
              <tr key={u.id} onClick={() => setSelected(u)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={u} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{shortName(u)}</p>
                      {u.generic && <p className="text-xs text-slate-400">Cuenta funcional</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 font-mono">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3 text-sm text-slate-600">{deptName(u.departmentSlug, depts)}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-500">{u.ci || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-PY') : 'Nunca'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs ${u.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserDrawer user={selected} depts={depts} me={me} onClose={() => setSelected(null)} onSaved={() => { reload(); setSelected(null); }} />
      <InviteModal open={showInvite} depts={depts} onClose={() => setShowInvite(false)} onSaved={() => { reload(); setShowInvite(false); }} />
    </div>
  );
}

function UserDrawer({ user, depts, me, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    if (user) {
      setForm({ role: user.role, departmentSlug: user.departmentSlug || '', ci: user.ci || '' });
      setErr(null);
    }
  }, [user]);

  if (!user || !form) return null;

  const canChangeRole = me?.role === 'SUPER_ADMIN' || (!['SUPER_ADMIN','IT_ADMIN'].includes(form.role));

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await usersApi.update(user.id, {
        role: form.role,
        departmentSlug: form.departmentSlug || null,
        ci: form.ci || null,
      });
      onSaved();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  const toggleActive = async () => {
    setBusy(true); setErr(null);
    try {
      if (user.isActive) await usersApi.deactivate(user.id);
      else await usersApi.activate(user.id);
      onSaved();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    const msg = `¿Eliminar definitivamente a ${user.name}?\n\n` +
                `Esta acción no se puede deshacer. Si el usuario tiene actividad ` +
                `histórica (activos asignados, tickets, actas), el sistema lo bloqueará ` +
                `y te sugerirá desactivar en su lugar.`;
    if (!window.confirm(msg)) return;
    setBusy(true); setErr(null);
    try {
      await usersApi.remove(user.id);
      onSaved();
    } catch (e) {
      const data = e.response?.data;
      let text = data?.error || e.message;
      if (Array.isArray(data?.blockers) && data.blockers.length) {
        text += '\n\n• ' + data.blockers.join('\n• ') + (data.suggestion ? `\n\n${data.suggestion}` : '');
      }
      setErr(text);
    } finally { setBusy(false); }
  };

  const canDelete = me?.role === 'SUPER_ADMIN' && user.id !== me?.id;

  return (
    <Drawer
      open={!!user}
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={toggleActive}
              disabled={busy || user.id === me?.id}
              className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
                user.isActive
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              {user.isActive ? 'Desactivar' : 'Reactivar'}
            </button>
            {canDelete && (
              <button
                onClick={remove}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                title="Borrado definitivo. Solo si el usuario no tiene actividad histórica."
              >
                Eliminar
              </button>
            )}
          </div>
          <button onClick={save} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            Guardar cambios
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{user.name}</p>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
            {user.generic && <p className="text-xs text-amber-600 mt-1">Cuenta funcional</p>}
          </div>
        </div>

        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 whitespace-pre-wrap">{err}</div>}

        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Identidad y acceso</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={!canChangeRole}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Departamento</label>
              <select
                value={form.departmentSlug}
                onChange={(e) => setForm({ ...form, departmentSlug: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">— Sin asignar —</option>
                {depts.map(d => <option key={d.slug} value={d.slug}>{d.parentSlug ? '  · ' : ''}{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">CI</label>
              <input
                value={form.ci}
                onChange={(e) => setForm({ ...form, ci: e.target.value })}
                placeholder="Ej: 4.383.566"
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Sesión</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Google ID</dt><dd className="font-mono text-slate-700">{user.googleId || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Última sesión</dt><dd className="text-slate-700">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-PY') : 'Nunca'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Estado</dt><dd className="text-slate-700">{user.isActive ? 'Activo' : 'Inactivo'}</dd></div>
          </dl>
        </section>
      </div>
    </Drawer>
  );
}

function InviteModal({ open, depts, onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', role: 'EMPLOYEE', departmentSlug: '', ci: '', nameFirst: '', nameLast: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    if (open) { setForm({ email: '', role: 'EMPLOYEE', departmentSlug: '', ci: '', nameFirst: '', nameLast: '' }); setErr(null); }
  }, [open]);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setErr(null);
    try {
      await usersApi.invite({
        ...form,
        name: `${form.nameFirst} ${form.nameLast}`.trim() || form.email.split('@')[0],
        departmentSlug: form.departmentSlug || null,
      });
      onSaved();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invitar usuario"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={submit} disabled={busy || !form.email} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            Enviar invitación
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          El usuario se aprovisiona en su primer login con Google. Acá solo se pre-configura su rol, departamento y CI.
        </div>

        {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{err}</div>}

        <div>
          <label className="text-xs font-medium text-slate-500">Email corporativo *</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="nombre.apellido@penguin.digital"
            required
            type="email"
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Nombre</label>
            <input value={form.nameFirst} onChange={(e) => setForm({ ...form, nameFirst: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Apellido</label>
            <input value={form.nameLast} onChange={(e) => setForm({ ...form, nameLast: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Departamento</label>
          <select value={form.departmentSlug} onChange={(e) => setForm({ ...form, departmentSlug: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">— Sin asignar —</option>
            {depts.map(d => <option key={d.slug} value={d.slug}>{d.parentSlug ? '  · ' : ''}{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">CI (opcional)</label>
          <input value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} placeholder="Requerido para emitir actas" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
        </div>
      </form>
    </Modal>
  );
}
