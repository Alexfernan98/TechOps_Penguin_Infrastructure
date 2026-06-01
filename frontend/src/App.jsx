import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
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

export default function App() {
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/assets/*"  element={<ComingSoon title="Inventario de Activos" />} />
        <Route path="/tickets/*" element={<ComingSoon title="Sistema de Tickets" />} />
        <Route path="/actas/*"   element={<ComingSoon title="Actas de Entrega" />} />
        <Route path="/users/*"   element={<ComingSoon title="Usuarios" />} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
