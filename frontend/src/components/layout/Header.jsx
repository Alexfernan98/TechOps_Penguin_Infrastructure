import { LogOut, ChevronDown, Bell, Menu, Sun, Moon } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import useThemeStore from '@/store/themeStore';
import { notificationsApi } from '@/api/notifications';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  IT_ADMIN:    'IT Admin',
  IT_TECH:     'IT Técnico',
  EMPLOYEE:    'Empleado',
  READ_ONLY:   'Solo lectura',
};

const TYPE_DOT = { WARRANTY: 'bg-amber-500', SLA: 'bg-rose-500', TICKET_UPDATE: 'bg-blue-500', ASSIGNMENT: 'bg-emerald-500', ACTA: 'bg-blue-500', SYSTEM: 'bg-slate-400' };

function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });

  const load = useCallback(async () => {
    try { setData(await notificationsApi.list({ limit: 10 })); } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const markAll = async () => { try { await notificationsApi.readAll(); load(); } catch { /* noop */ } };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(v => !v); if (!open) load(); }} className="relative p-2 rounded-lg hover:bg-slate-100">
        <Bell className="w-5 h-5 text-slate-500" />
        {data.unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Notificaciones</p>
              <button onClick={markAll} className="text-xs text-blue-600 hover:underline">Marcar todas leídas</button>
            </div>
            <div className="max-h-80 overflow-auto">
              {data.notifications.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Sin notificaciones</p>}
              {data.notifications.map(n => (
                <div key={n.id} className={`flex items-start gap-2 px-4 py-3 border-b border-slate-50 ${n.readAt ? '' : 'bg-blue-50/40'}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_DOT[n.type] || 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setOpen(false); navigate('/notificaciones'); }} className="w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-slate-50 border-t border-slate-100">Ver todas</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Header({ title, onToggleSidebar }) {
  const { user, logout } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base md:text-lg font-semibold text-slate-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark'
            ? <Sun className="w-5 h-5 text-amber-400" />
            : <Moon className="w-5 h-5 text-slate-500" />}
        </button>
        <NotificationsBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="text-left hidden lg:block max-w-[180px]">
              <p className="text-sm font-medium text-slate-800 leading-tight truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[user?.role] ?? user?.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
