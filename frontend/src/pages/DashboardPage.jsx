import useAuthStore from '@/store/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          Bienvenido, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-slate-500 mt-1">Panel de control — TechOpsHub Penguin Infrastructure</p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total activos',      value: '—', color: 'bg-blue-50 text-blue-600' },
          { label: 'Activos disponibles', value: '—', color: 'bg-green-50 text-green-600' },
          { label: 'Tickets abiertos',   value: '—', color: 'bg-orange-50 text-orange-600' },
          { label: 'Garantías por vencer', value: '—', color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 mb-2">{label}</p>
            <p className={`text-2xl font-bold px-2 py-0.5 rounded-lg inline-block ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🚧</span>
        </div>
        <p className="text-slate-600 font-medium">Dashboard en construcción</p>
        <p className="text-slate-400 text-sm mt-1">Los KPIs estarán disponibles en Fase 4</p>
      </div>
    </div>
  );
}
