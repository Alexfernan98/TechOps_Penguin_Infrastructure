import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, Package, Ticket, FileText, Bell, Users, ShieldCheck, Settings, X, ChevronDown, ArrowDownToLine, ArrowUpFromLine, Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import useAuthStore from '@/store/authStore';
import clsx from 'clsx';
import { version as APP_VERSION } from '../../../package.json';

const ROUTES_BY_ROLE = {
  SUPER_ADMIN: ['dashboard', 'assets', 'stock', 'tickets', 'actas', 'notificaciones', 'users', 'audit', 'config'],
  IT_ADMIN:    ['dashboard', 'assets', 'stock', 'tickets', 'actas', 'notificaciones', 'users', 'audit', 'config'],
  IT_TECH:     ['dashboard', 'assets', 'stock', 'tickets', 'actas', 'notificaciones'],
  EMPLOYEE:    ['dashboard', 'tickets', 'actas', 'notificaciones'],
  READ_ONLY:   ['dashboard', 'assets', 'stock', 'tickets', 'actas', 'notificaciones', 'audit'],
};

const NAV_ITEMS = [
  { key: 'dashboard',      to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { key: 'assets',         to: '/assets',         label: 'Inventario',     icon: Monitor },
  { key: 'stock',          to: '/stock',          label: 'Almacén',        icon: Package },
  { key: 'tickets',        to: '/tickets',        label: 'Tickets',        icon: Ticket },
  {
    key: 'actas', label: 'Actas', icon: FileText,
    children: [
      { key: 'actas-delivery',   to: '/actas?type=DELIVERY',   label: 'Entregas',     icon: ArrowDownToLine },
      { key: 'actas-return',     to: '/actas?type=RETURN',     label: 'Devoluciones', icon: ArrowUpFromLine },
      { key: 'actas-retirement', to: '/actas?type=RETIREMENT', label: 'Bajas',        icon: Archive },
    ],
  },
  { key: 'notificaciones', to: '/notificaciones', label: 'Notificaciones', icon: Bell },
];

const ADMIN_ITEMS = [
  { key: 'users',  to: '/users',  label: 'Usuarios',      icon: Users },
  { key: 'audit',  to: '/audit',  label: 'Auditoría',     icon: ShieldCheck },
  { key: 'config', to: '/config', label: 'Configuración', icon: Settings },
];

// NavGroup: item con sub-items expandibles. Se abre automático cuando la ruta
// activa coincide con alguno de los hijos.
function NavGroup({ label, Icon, basePath, children, onNavigate }) {
  const location = useLocation();
  const isInGroup = location.pathname.startsWith(basePath);
  const [open, setOpen] = useState(isInGroup);

  useEffect(() => { if (isInGroup) setOpen(true); }, [isInGroup]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isInGroup
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={clsx('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-slate-700/50 space-y-0.5">
          {children.map(({ key, to, label, icon: SubIcon }) => (
            <NavLink
              key={key}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) => {
                // isActive de NavLink ignora querystring — comparamos manualmente.
                const fullActive = (location.pathname + location.search) === to;
                return clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  fullActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                );
              }}
            >
              <SubIcon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, label, Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        )
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </NavLink>
  );
}

// Sidebar responsive:
//  - md+: fija a la izquierda (264px) siempre visible.
//  - mobile (<md): off-canvas, se abre con el hamburger del Header y se cierra
//    con backdrop, ESC, o al navegar a una ruta.
export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user } = useAuthStore();
  const allowed = ROUTES_BY_ROLE[user?.role] || [];
  const mainItems  = NAV_ITEMS.filter(i => allowed.includes(i.key));
  const adminItems = ADMIN_ITEMS.filter(i => allowed.includes(i.key));
  const { pathname } = useLocation();

  // Cerrar al navegar (en mobile).
  useEffect(() => { onClose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop solo en mobile cuando está abierto */}
      <div
        className={clsx(
          'fixed inset-0 bg-slate-900/60 z-30 transition-opacity md:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          // fixed en ambos breakpoints — sticky no funciona si un ancestor tiene
          // overflow-hidden (lo necesitamos para evitar scroll horizontal global).
          // En desktop compensamos con `md:pl-64` en el contenido principal.
          'fixed top-0 left-0 h-screen w-64 bg-slate-900 flex flex-col z-40 transform transition-transform md:transform-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="h-16 px-6 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
              <img src="/logo-penguin.png" alt="Penguin" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">NetHub</p>
              <p className="text-slate-400 text-xs truncate">Penguin Infrastructure</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 -mr-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {mainItems.map((item) => item.children
            ? <NavGroup key={item.key} label={item.label} Icon={item.icon} basePath={`/${item.key}`} children={item.children} onNavigate={onClose} />
            : <NavItem  key={item.key} to={item.to} label={item.label} Icon={item.icon} onNavigate={onClose} />
          )}

          {adminItems.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administración</p>
              </div>
              {adminItems.map(({ key, to, label, icon }) => (
                <NavItem key={key} to={to} label={label} Icon={icon} onNavigate={onClose} />
              ))}
            </>
          )}
        </nav>

        <div className="px-6 py-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">NetHub v{APP_VERSION}</p>
        </div>
      </aside>
    </>
  );
}
