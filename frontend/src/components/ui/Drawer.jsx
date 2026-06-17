import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className="absolute top-0 right-0 h-full bg-white dark:bg-slate-800 dark:border-l dark:border-slate-700 shadow-2xl flex flex-col"
        style={{ width: `${width}px`, maxWidth: '100%' }}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 truncate">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">{footer}</div>}
      </div>
    </div>
  );
}
