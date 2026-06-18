import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Boxes, UserCheck, PackageCheck, Wrench, ShieldAlert, Archive, Ticket, FileSignature } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi } from '@/api/dashboard';
import useAuthStore from '@/store/authStore';
import { ASSET_STATUS_LABEL, PRIORITY_LABEL } from '@/components/ui/Badge';

const STATUS_COLORS = { AVAILABLE: '#10b981', ASSIGNED: '#3b82f6', LOAN: '#8b5cf6', REPAIR: '#f59e0b', DAMAGED: '#f43f5e', RETIRED: '#94a3b8', LOST: '#1e293b' };
const PRIORITY_COLORS = { CRITICAL: '#e11d48', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#94a3b8' };

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, children, className }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [d, setD] = useState(null);

  useEffect(() => { dashboardApi.get().then(setD).catch(e => toast.error(e.response?.data?.error || e.message)); }, []);

  if (!d) return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Bienvenido, {user?.name?.split(' ')[0]} 👋</h2>
      <p className="text-slate-400">Cargando indicadores…</p>
    </div>
  );

  const k = d.kpis || {};
  const assetsByStatus      = Array.isArray(d.assetsByStatus)     ? d.assetsByStatus     : [];
  const assetsByDepartment  = Array.isArray(d.assetsByDepartment) ? d.assetsByDepartment : [];
  const ticketsByPriority   = Array.isArray(d.ticketsByPriority)  ? d.ticketsByPriority  : [];
  const ticketsByMonth      = Array.isArray(d.ticketsByMonth)     ? d.ticketsByMonth     : [];
  const slaCompliance       = typeof d.slaCompliance === 'number' ? d.slaCompliance      : 100;
  const statusData = assetsByStatus.map(s => ({ name: ASSET_STATUS_LABEL[s.status] || s.status, value: s.count, key: s.status }));
  const slaGauge = [{ name: 'SLA', value: slaCompliance, fill: slaCompliance >= 90 ? '#10b981' : slaCompliance >= 75 ? '#f59e0b' : '#f43f5e' }];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Bienvenido, {user?.name?.split(' ')[0]} 👋</h2>
        <p className="text-slate-500 mt-1">Panel de control — NetHub Penguin Infrastructure</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Boxes}        label="Total activos"      value={k.totalAssets}  color="text-blue-600" />
        <KpiCard icon={UserCheck}    label="Asignados"          value={k.assigned}     sub={k.totalAssets ? `${Math.round(k.assigned / k.totalAssets * 100)}% del total` : ''} color="text-indigo-600" />
        <KpiCard icon={PackageCheck} label="Disponibles"        value={k.available}    color="text-emerald-600" />
        <KpiCard icon={Wrench}       label="En reparación"      value={k.repair}       color="text-amber-600" />
        <KpiCard icon={ShieldAlert}  label="Garantías por vencer" value={k.warrantySoon} sub="< 90 días" color="text-rose-600" />
        <KpiCard icon={Archive}      label="Bajas históricas"   value={k.retiredHistorical} color="text-slate-500" />
        <KpiCard icon={Ticket}       label="Tickets abiertos"   value={k.ticketsOpen}  sub={`${k.ticketsCritical} críticos`} color="text-blue-600" />
        <KpiCard icon={FileSignature} label="Actas pendientes"  value={k.actasPending} sub="de firma" color="text-violet-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card title="Activos por estado">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {statusData.map(s => <Cell key={s.key} fill={STATUS_COLORS[s.key] || '#cbd5e1'} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Tickets abiertos por prioridad">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ticketsByPriority.map(p => ({ name: PRIORITY_LABEL[p.priority], count: p.count, key: p.priority }))} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {ticketsByPriority.map(p => <Cell key={p.priority} fill={PRIORITY_COLORS[p.priority]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="SLA cumplido">
          <div className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <RadialBarChart cx="50%" cy="70%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={slaGauge}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-x-0 top-1/2 text-center">
              <p className="text-3xl font-bold text-slate-800">{slaCompliance}%</p>
              <p className="text-xs text-slate-400">resueltos en plazo</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Activos por departamento (top 8)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={assetsByDepartment} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Volumen de tickets (últimos 6 meses)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={ticketsByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} label={{ position: 'top', fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
