import { LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '@/store/authStore';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  IT_ADMIN:    'IT Admin',
  IT_TECH:     'IT Técnico',
  EMPLOYEE:    'Empleado',
  READ_ONLY:   'Solo lectura',
};

export default function Header({ title }) {
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">

      {/* Título de la página */}
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>

      {/* Usuario */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-slate-800 leading-tight">{user?.name}</p>
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
    </header>
  );
}
