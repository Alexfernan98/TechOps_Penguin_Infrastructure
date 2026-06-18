import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '@/components/ErrorBoundary';

const PAGE_TITLES = {
  '/dashboard':      'Dashboard',
  '/assets':         'Inventario de Activos',
  '/tickets':        'Tickets',
  '/actas':          'Actas de Entrega',
  '/notificaciones': 'Notificaciones',
  '/users':          'Usuarios',
  '/audit':          'Auditoría',
  '/config':         'Configuración',
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'NetHub';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 w-full overflow-x-hidden md:pl-64">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col min-h-screen w-full">
        <Header title={title} onToggleSidebar={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
