import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// ConfirmDialog reutilizable, coherente con el diseño de la app.
// Reemplaza al window.confirm() del browser (que usaba el estilo nativo del OS).
//
// Uso:
//   const confirm = useConfirm();
//   const ok = await confirm({
//     title: '¿Eliminar usuario?',
//     description: 'Esta acción no se puede deshacer.',
//     confirmLabel: 'Eliminar',
//     tone: 'danger',
//   });
//   if (ok) { /* proceder */ }

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise(resolve => {
      setState({
        title:        opts.title        || '¿Confirmar acción?',
        description:  opts.description  || '',
        confirmLabel: opts.confirmLabel || 'Confirmar',
        cancelLabel:  opts.cancelLabel  || 'Cancelar',
        tone:         opts.tone         || 'primary', // 'primary' | 'danger'
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    if (state?.resolve) state.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <ConfirmModal state={state} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}

function ConfirmModal({ state, onClose }) {
  const { title, description, confirmLabel, cancelLabel, tone } = state;
  const isDanger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/70" onClick={() => onClose(false)} />
      <div className="relative bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="px-5 pt-5 pb-4 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
            isDanger ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            {description && (
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{description}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end gap-2 rounded-b-xl">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onClose(true)}
            autoFocus
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
