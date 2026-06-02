import { useEffect, useState, useCallback } from 'react';
import { CheckCheck, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationsApi } from '@/api/notifications';

const TYPE_DOT = { WARRANTY: 'bg-amber-500', SLA: 'bg-rose-500', TICKET_UPDATE: 'bg-blue-500', ASSIGNMENT: 'bg-emerald-500', ACTA: 'bg-blue-500', SYSTEM: 'bg-slate-400' };

const TRIGGERS = [
  ['Garantía por vencer (< 90 días)', 'Diaria 08:00', 'IT_ADMIN', 'WARRANTY'],
  ['SLA de respuesta vencido / en riesgo', 'Cron 5 min', 'Técnico + IT_ADMIN', 'SLA'],
  ['Cambio de estado de ticket', 'Inmediato', 'Solicitante', 'TICKET_UPDATE'],
  ['Nueva asignación de activo', 'Inmediato', 'Receptor', 'ASSIGNMENT'],
  ['Acta firmada subida a Drive', 'Inmediato', 'IT_ADMIN + Receptor', 'ACTA'],
];

export default function NotificationsPage() {
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await notificationsApi.list({ limit: 100 })); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const markRead = async (n) => { if (n.readAt) return; try { await notificationsApi.read(n.id); reload(); } catch { /* noop */ } };
  const markAll = async () => { try { await notificationsApi.readAll(); reload(); toast.success('Todas marcadas como leídas'); } catch (e) { toast.error(e.message); } };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Notificaciones</h2>
          <p className="text-slate-500 mt-1">{data.unread} sin leer</p>
        </div>
        <button onClick={markAll} disabled={!data.unread} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40"><CheckCheck className="w-4 h-4" /> Marcar todas leídas</button>
      </div>

      <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <p className="text-sm font-semibold text-slate-700 mb-2">Triggers automáticos del sistema</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {TRIGGERS.map(([label, freq, to, type]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${TYPE_DOT[type]}`} />
              <span className="text-slate-700">{label}</span>
              <span className="text-xs text-slate-400 ml-auto">{freq} · {to}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {loading && <p className="p-10 text-center text-slate-400">Cargando…</p>}
        {!loading && data.notifications.length === 0 && (
          <div className="p-10 text-center text-slate-400"><Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" /><p>Sin notificaciones</p></div>
        )}
        {!loading && data.notifications.map(n => (
          <div key={n.id} onClick={() => markRead(n)} className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50 ${n.readAt ? '' : 'bg-blue-50/40'}`}>
            <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_DOT[n.type] || 'bg-slate-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{n.title}</p>
              <p className="text-sm text-slate-600">{n.body}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString('es-PY')}</p>
            </div>
            {!n.readAt && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
