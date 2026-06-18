import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Printer, Upload, ExternalLink, FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { actasApi } from '@/api/actas';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import useAuthStore from '@/store/authStore';
import { API_BASE, ORIGIN } from '@/api/axios';
import api from '@/api/axios';

// Resuelve la URL absoluta de un PDF de acta según de dónde viene:
//  - http(s)://...  → tal cual (Drive u origen externo)
//  - /uploads/...   → `${ORIGIN}/uploads/...` (montado fuera de /api)
//  - /actas/...     → `${API_BASE}/actas/...` (preview/pdf endpoints REST)
function resolveActaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads/')) return `${ORIGIN}${path}`;
  return `${API_BASE}${path}`;
}
import Drawer from '@/components/ui/Drawer';
import Modal from '@/components/ui/Modal';
import { shortName } from '@/components/ui/Avatar';
import { ActaTypeBadge, ACTA_TYPE_LABEL } from '@/components/ui/Badge';

const TYPES = ['DELIVERY', 'RETURN', 'RETIREMENT'];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-PY') : '—';
const statusLabel = (s) => s === 'signed' ? 'Firmada' : 'Pendiente firma';

export default function ActasPage() {
  // Lee el tipo del querystring (?type=DELIVERY|RETURN|RETIREMENT) — la sidebar
  // navega con esa convención. Cuando cambia el query, refresca el filtro.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlType = searchParams.get('type') || '';

  const [actas, setActas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ search: '', type: urlType, status: '' });
  const [selectedId, setSelectedId] = useState(null);

  // Sincronizar filter.type ↔ querystring (navegación desde sidebar).
  useEffect(() => { setF((prev) => prev.type === urlType ? prev : { ...prev, type: urlType }); }, [urlType]);
  const setTypeFilter = (t) => {
    setF({ ...f, type: t });
    if (t) setSearchParams({ type: t }); else setSearchParams({});
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try { setActas(await actasApi.list()); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => actas.filter(a => {
    if (f.type && a.type !== f.type) return false;
    if (f.status && a.statusActa !== f.status) return false;
    if (f.search) { const s = f.search.toLowerCase(); if (![a.number, a.asset?.tag, a.receptor?.name].some(v => (v || '').toLowerCase().includes(s))) return false; }
    return true;
  }), [actas, f]);

  const kpis = useMemo(() => ({
    total: actas.length,
    pending: actas.filter(a => a.statusActa !== 'signed').length,
    signed: actas.filter(a => a.statusActa === 'signed').length,
  }), [actas]);

  // Archivos de Drive (solo cuando hay un tipo seleccionado en el filtro).
  // Listado read-only, complementa a las actas tracked en BD.
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState(null);
  useEffect(() => {
    if (!f.type) { setDriveFiles([]); setDriveError(null); return; }
    setDriveLoading(true); setDriveError(null);
    import('@/api/drive').then(({ driveApi }) => driveApi.listActas(f.type))
      .then(({ files }) => setDriveFiles(files || []))
      .catch(e => setDriveError(e.response?.data?.error || e.message))
      .finally(() => setDriveLoading(false));
  }, [f.type]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Actas</h2>
        <p className="text-slate-500 mt-1">Entrega · Devolución · Baja — se generan desde Inventario</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {[['Total', kpis.total, 'text-slate-700'], ['Pendientes de firma', kpis.pending, 'text-amber-600'], ['Firmadas', kpis.signed, 'text-emerald-600']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{l}</p><p className={`text-2xl font-bold mt-1 ${c}`}>{v}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={f.search} onChange={e => setF({ ...f, search: e.target.value })} placeholder="Buscar por N°, TAG o receptor…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <select value={f.type} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Tipo</option>{TYPES.map(t => <option key={t} value={t}>{ACTA_TYPE_LABEL[t]}</option>)}</select>
        <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">Estado</option><option value="pending_sign">Pendiente firma</option><option value="signed">Firmada</option></select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
              <th className="px-4 py-3">N°</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Receptor</th><th className="px-4 py-3">Firmante</th><th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Drive</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Sin actas</td></tr>}
            {!loading && filtered.map(a => (
              <tr key={a.id} onClick={() => setSelectedId(a.id)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3 text-sm font-mono text-slate-700">{a.number}</td>
                <td className="px-4 py-3"><ActaTypeBadge type={a.type} /></td>
                <td className="px-4 py-3 text-sm font-mono text-slate-600">{a.asset?.tag}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.type === 'RETIREMENT' ? '—' : shortName(a.receptor)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{shortName(a.firmante)}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{fmtDate(a.signedAt)}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium ${a.statusActa === 'signed' ? 'text-emerald-600' : 'text-amber-600'}`}>{statusLabel(a.statusActa)}</span></td>
                <td className="px-4 py-3">{a.signedDriveUrl ? <a href={a.signedDriveUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600"><ExternalLink className="w-4 h-4" /></a> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {f.type && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Archivos en Drive · {ACTA_TYPE_LABEL[f.type]}
            </h3>
            <span className="text-xs text-slate-400">
              {driveLoading ? 'Cargando…' : `${driveFiles.length} archivo${driveFiles.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {driveError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 mb-3">
              No se pudo leer Drive: {driveError}
              <p className="text-xs mt-1 text-rose-600">
                Si dice "tokens", cerrá sesión y volvé a entrar con Google para autorizar Drive.
              </p>
            </div>
          )}
          {!driveLoading && !driveError && driveFiles.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center bg-white rounded-xl border border-slate-200">
              No hay archivos en la carpeta de Drive de {ACTA_TYPE_LABEL[f.type].toLowerCase()}s.
            </p>
          )}
          {driveFiles.length > 0 && (
            <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {driveFiles.map(f => (
                <li key={f.id}>
                  <a
                    href={f.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(f.modifiedTime)}
                        {f.owners?.[0]?.displayName ? ` · ${f.owners[0].displayName}` : ''}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedId && <ActaDrawer id={selectedId} onClose={() => setSelectedId(null)} onRefresh={reload} />}
    </div>
  );
}

function ActaDrawer({ id, onClose, onRefresh }) {
  const [acta, setActa] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const { user: me } = useAuthStore();
  const confirm = useConfirm();
  const canDelete = ['IT_ADMIN', 'SUPER_ADMIN'].includes(me?.role);

  const load = useCallback(async () => {
    try { setActa(await actasApi.get(id)); }
    catch (e) { toast.error(e.response?.data?.error || e.message); onClose(); }
  }, [id, onClose]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar acta ${acta.number}?`,
      description:
        'Esta acción no se puede deshacer. El registro y el PDF firmado (si lo hay) se eliminan permanentemente. ' +
        'Quedará un snapshot en /audit para consulta.',
      confirmLabel: 'Eliminar acta',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await actasApi.remove(id);
      toast.success(`Acta ${acta.number} eliminada`);
      onRefresh();
      onClose();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  if (!acta) return <Drawer open onClose={onClose} title="Cargando…" width={640}><p className="text-slate-400">Cargando…</p></Drawer>;
  const signed = acta.statusActa === 'signed';
  const src = acta.signedDriveUrl || resolveActaUrl(acta.pdfUrl) || resolveActaUrl(actasApi.previewUrl(id));

  return (
    <>
      <Drawer open onClose={onClose} width={680}
        title={<span className="font-mono">{acta.number}</span>}
        subtitle={`${ACTA_TYPE_LABEL[acta.type]} · ${acta.asset?.tag}`}
        footer={
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <a href={resolveActaUrl(actasApi.pdfUrl(id))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"><Printer className="w-4 h-4" /> Imprimir / PDF</a>
              {canDelete && <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-2 border border-rose-200 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-50" title="Borrar acta (uso típico: limpiar pruebas)"><Trash2 className="w-4 h-4" /> Eliminar</button>}
            </div>
            <div className="flex items-center gap-2">
              {!signed && <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"><Upload className="w-4 h-4" /> Subir firmada</button>}
              {signed && acta.signedDriveUrl && <a href={acta.signedDriveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"><ExternalLink className="w-4 h-4" /> Abrir en Drive</a>}
            </div>
          </div>
        }
      >
        <div className="flex items-center gap-2 mb-3">
          <ActaTypeBadge type={acta.type} />
          <span className={`text-xs font-medium ${signed ? 'text-emerald-600' : 'text-amber-600'}`}>{statusLabel(acta.statusActa)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div><p className="text-xs text-slate-400">Receptor</p><p className="text-slate-700">{acta.type === 'RETIREMENT' ? '— (sin receptor)' : shortName(acta.receptor)}</p></div>
          <div><p className="text-xs text-slate-400">Firmante</p><p className="text-slate-700">{shortName(acta.firmante)}</p></div>
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden" style={{ height: 520 }}>
          <iframe title="preview" src={signed ? src : resolveActaUrl(actasApi.previewUrl(id))} className="w-full h-full" />
        </div>
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><FileText className="w-3 h-3" /> Vista previa del documento {signed ? 'firmado' : 'generado'}.</p>
      </Drawer>

      {showUpload && <UploadSignedModal id={id} onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); onRefresh(); }} />}
    </>
  );
}

function UploadSignedModal({ id, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file && !driveUrl) { toast.error('Subí un PDF o pegá un link de Drive'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (driveUrl) fd.append('driveUrl', driveUrl);
      await api.post(`/actas/${id}/upload-signed`, fd);
      toast.success('Acta firmada subida'); onDone();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Subir acta firmada"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={submit} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Subir</button></div>}>
      <div className="space-y-3">
        <div><label className="text-xs font-medium text-slate-500">PDF firmado</label><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm" /></div>
        <div className="text-center text-xs text-slate-400">— o —</div>
        <div><label className="text-xs font-medium text-slate-500">URL en Google Drive (opcional)</label><input value={driveUrl} onChange={e => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
        <p className="text-xs text-slate-400">En producción el PDF se sube a la carpeta de Drive configurada (DRIVE_ACTAS_FOLDER_ID) y se guarda sólo el link.</p>
      </div>
    </Modal>
  );
}
