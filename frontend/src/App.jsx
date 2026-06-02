import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AssetsPage from '@/pages/AssetsPage';
import ActasPage from '@/pages/ActasPage';
import TicketsPage from '@/pages/TicketsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import AuditPage from '@/pages/AuditPage';
import UsersPage from '@/pages/UsersPage';
import ConfigPage from '@/pages/ConfigPage';
import useAuthStore from '@/store/authStore';

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
        <Route path="/tickets"   element={<TicketsPage />} />
        <Route path="/actas"     element={<ActasPage />} />
        <Route path="/notificaciones" element={<NotificationsPage />} />
        <Route path="/assets" element={
          <RequireRole roles={['SUPER_ADMIN', 'IT_ADMIN', 'IT_TECH', 'READ_ONLY']}><AssetsPage /></RequireRole>
        } />
        <Route path="/audit" element={
          <RequireRole roles={['SUPER_ADMIN', 'IT_ADMIN', 'READ_ONLY']}><AuditPage /></RequireRole>
        } />
        <Route path="/users" element={
          <RequireRole roles={['SUPER_ADMIN', 'IT_ADMIN']}><UsersPage /></RequireRole>
        } />
        <Route path="/config" element={
          <RequireRole roles={['SUPER_ADMIN']}><ConfigPage /></RequireRole>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
