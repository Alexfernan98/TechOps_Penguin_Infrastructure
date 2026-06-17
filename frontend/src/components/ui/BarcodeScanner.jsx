import { useEffect, useRef, useState } from 'react';
import { Camera, X, ScanLine, AlertTriangle } from 'lucide-react';

// Scanner de código de barras usando la cámara del dispositivo.
// Carga @zxing/browser bajo demanda para no engordar el bundle inicial.
// Devuelve el código detectado vía onDetect(text). Cancela con onClose().
export default function BarcodeScanner({ open, onDetect, onClose, expect6Digits = true }) {
  const videoRef    = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Verificación temprana: la API de cámara solo está disponible en contextos seguros
    // (HTTPS o localhost). Sobre HTTP plano (LAN) navigator.mediaDevices es undefined.
    const hasCameraAPI = typeof navigator !== 'undefined'
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function';

    if (!hasCameraAPI) {
      setError(
        window.isSecureContext === false
          ? 'La cámara no está disponible en HTTP. Accedé por HTTPS (o localhost) para escanear, o ingresá el código manualmente abajo.'
          : 'Este navegador no soporta acceso a la cámara. Ingresá el código manualmente.'
      );
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const list = await BrowserMultiFormatReader.listVideoInputDevices().catch(() => []);
        if (cancelled) return;
        setDevices(list);
        const back = list.find(d => /back|rear|trás|environment/i.test(d.label || ''));
        const chosen = deviceId || back?.deviceId || list[0]?.deviceId;
        setDeviceId(chosen || '');

        const controls = await reader.decodeFromVideoDevice(chosen || undefined, videoRef.current, (result) => {
          if (!result || cancelled) return;
          const text = String(result.getText() || '').trim();
          if (!text) return;
          if (expect6Digits) {
            const digits = text.replace(/\D/g, '');
            if (digits.length < 4 || digits.length > 12) return;
            onDetect(digits.padStart(6, '0').slice(-6));
          } else {
            onDetect(text);
          }
        });
        controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'No se pudo iniciar la cámara. Ingresá el código manualmente.');
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* noop */ }
      controlsRef.current = null;
    };
  }, [open, deviceId, expect6Digits, onDetect]);

  if (!open) return null;

  const submitManual = () => {
    if (!manual) return;
    if (expect6Digits) {
      const digits = manual.replace(/\D/g, '');
      if (digits.length < 1 || digits.length > 6) {
        setError('Ingresá un número de hasta 6 dígitos');
        return;
      }
      onDetect(digits.padStart(6, '0'));
    } else {
      onDetect(manual.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">Escanear código de barras</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="relative bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="border-2 border-blue-500/80 rounded-lg" style={{ width: '70%', height: '40%' }}>
              <ScanLine className="w-full h-full opacity-30 text-blue-300" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3 overflow-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {devices.length > 1 && (
            <div>
              <label className="text-xs font-medium text-slate-500">Cámara</label>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${d.deviceId.slice(0, 6)}`}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500">O ingresar manualmente</label>
            <div className="mt-1 flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
                placeholder={expect6Digits ? 'Ej: 000700 ó 700' : 'Código…'}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                inputMode={expect6Digits ? 'numeric' : 'text'}
              />
              <button onClick={submitManual} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
                Aceptar
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Apuntá la cámara al código o tipeá el número.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
