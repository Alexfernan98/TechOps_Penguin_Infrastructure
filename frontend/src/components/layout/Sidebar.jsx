import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Monitor, Ticket, FileText, Bell, Users, ShieldCheck, Settings } from 'lucide-react';
import useAuthStore from '@/store/authStore';
import clsx from 'clsx';

const ROUTES_BY_ROLE = {
  SUPER_ADMIN: ['dashboard', 'assets', 'tickets', 'actas', 'notificaciones', 'users', 'audit', 'config'],
  IT_ADMIN:    ['dashboard', 'assets', 'tickets', 'actas', 'notificaciones', 'users', 'audit', 'config'],
  IT_TECH:     ['dashboard', 'assets', 'tickets', 'actas', 'notificaciones'],
  EMPLOYEE:    ['dashboard', 'tickets', 'actas', 'notificaciones'],
  READ_ONLY:   ['dashboard', 'assets', 'tickets', 'actas', 'notificaciones', 'audit'],
};

const NAV_ITEMS = [
  { key: 'dashboard',      to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { key: 'assets',         to: '/assets',         label: 'Inventario',     icon: Monitor },
  { key: 'tickets',        to: '/tickets',        label: 'Tickets',        icon: Ticket },
  { key: 'actas',          to: '/actas',          label: 'Actas',          icon: FileText },
  { key: 'notificaciones', to: '/notificaciones', label: 'Notificaciones', icon: Bell },
];

const ADMIN_ITEMS = [
  { key: 'users',  to: '/users',  label: 'Usuarios',      icon: Users },
  { key: 'audit',  to: '/audit',  label: 'Auditoría',     icon: ShieldCheck },
  { key: 'config', to: '/config', label: 'Configuración', icon: Settings },
];

function NavItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
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

export default function Sidebar() {
  const { user } = useAuthStore();
  const allowed = ROUTES_BY_ROLE[user?.role] || [];

  const mainItems  = NAV_ITEMS.filter(i => allowed.includes(i.key));
  const adminItems = ADMIN_ITEMS.filter(i => allowed.includes(i.key));

  return (
    <aside className="w-64 min-h-screen bg-slate-900 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">TechOpsHub</p>
            <p className="text-slate-400 text-xs">Penguin Infrastructure</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {mainItems.map(({ key, to, label, icon }) => (
          <NavItem key={key} to={to} label={label} Icon={icon} />
        ))}

        {adminItems.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administración</p>
            </div>
            {adminItems.map(({ key, to, label, icon }) => (
              <NavItem key={key} to={to} label={label} Icon={icon} />
            ))}
          </>
        )}
      </nav>

      <div className="px-6 py-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">v0.5.0 — Fases 0-5</p>
      </div>
    </aside>
  );
}
