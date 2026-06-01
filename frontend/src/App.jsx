import { Routes, Route, Navigate } from 'react-router-dom';

// Página de placeholder mientras se desarrolla la Fase 0
function ComingSoon({ title }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🚧</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm">Módulo en desarrollo — Fase 0</p>
      </div>
    </div>
  );
}

// Layout placeholder hasta que se implemente el layout real en Fase 0
function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header placeholder */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">T</span>
          </div>
          <span className="font-semibold text-gray-900">TechOpsHub</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            Fase 0 — Scaffolding
          </span>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        {/* Redirigir raíz al dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Módulos — se implementan en Fases 0-4 */}
        <Route path="/dashboard"  element={<ComingSoon title="Dashboard" />} />
        <Route path="/assets/*"   element={<ComingSoon title="Inventario de Activos" />} />
        <Route path="/tickets/*"  element={<ComingSoon title="Sistema de Tickets" />} />
        <Route path="/actas/*"    element={<ComingSoon title="Actas de Entrega" />} />
        <Route path="/users/*"    element={<ComingSoon title="Usuarios" />} />

        {/* Login — se implementa en Fase 0 */}
        <Route path="/login"      element={<ComingSoon title="Login con Google" />} />

        {/* 404 */}
        <Route path="*" element={<ComingSoon title="Página no encontrada" />} />
      </Routes>
    </AppShell>
  );
}
