import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import UsersPage from '@/pages/UsersPage';
import ConfigPage from '@/pages/ConfigPage';
import useAuthStore from '@/store/authStore';

function ComingSoon({ title }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
        <span className="text-2xl">🚧</span>
      </div>
      <p className="text-slate-700 font-medium">{title}</p>
      <p className="text-slate-400 text-sm mt-1">Módulo en desarrollo</p>
    </div>
  );
}

function RequireRole({ roles, children }) {
  const { user } = useAuthStore();
  if (!user) return null;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { fetchUser } = useAuthStore();

  useEffect(() => { fetchUser(); }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/assets/*"  element={<ComingSoon title="Inventario de Activos" />} />
        <Route path="/tickets/*" element={<ComingSoon title="Sistema de Tickets" />} />
        <Route path="/actas/*"   element={<ComingSoon title="Actas de Entrega" />} />
        <Route path="/audit"     element={<ComingSoon title="Auditoría" />} />
        <Route path="/users"     element={
          <RequireRole roles={['SUPER_ADMIN','IT_ADMIN']}><UsersPage /></RequireRole>
        } />
        <Route path="/config"    element={
          <RequireRole roles={['SUPER_ADMIN']}><ConfigPage /></RequireRole>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
