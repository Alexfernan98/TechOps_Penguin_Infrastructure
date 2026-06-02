import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

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
  const title = PAGE_TITLES[pathname] ?? 'TechOpsHub';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
