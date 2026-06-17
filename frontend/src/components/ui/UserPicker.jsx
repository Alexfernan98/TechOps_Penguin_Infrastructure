import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import Avatar, { shortName } from './Avatar';

// Combobox de usuarios con búsqueda. Reemplaza al <select> que mostraba 90+
// usuarios apilados ocupando media pantalla.
//
// props:
//  - users:   array de usuarios (con id, name, nameFirst, nameLast, email, ci, avatarUrl)
//  - value:   id del seleccionado (o '')
//  - onChange: (id) => void
//  - placeholder?: string
//  - requireCi?: boolean — si true, marca con badge los usuarios sin CI
export default function UserPicker({ users = [], value = '', onChange, placeholder = 'Seleccionar empleado…', requireCi = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  const selected = useMemo(() => users.find(u => u.id === value) || null, [users, value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users.slice(0, 200);
    return users.filter(u => {
      const fields = [u.name, u.nameFirst, u.nameLast, u.email, u.ci].filter(Boolean).join(' ').toLowerCase();
      return fields.includes(s);
    }).slice(0, 50);
  }, [users, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (u) => { onChange(u.id); setOpen(false); setQ(''); };

  return (
    <div className="relative" ref={boxRef}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-left flex items-center gap-2 hover:border-slate-300 focus:outline-none focus:border-blue-500"
        >
          {selected ? <>
            <Avatar user={selected} size={24} />
            <span className="flex-1 truncate">{shortName(selected)}</span>
            {requireCi && !selected.ci && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">sin CI</span>}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); }} className="p-0.5 rounded hover:bg-slate-100"><X className="w-3.5 h-3.5 text-slate-400" /></button>
          </> : <span className="text-slate-400 flex-1">{placeholder}</span>}
        </button>
      ) : (
        <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg overflow-hidden">
          <div className="px-2 py-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, CI o email…"
              className="flex-1 text-sm outline-none"
            />
            <span className="text-xs text-slate-400">{filtered.length}{filtered.length === 50 ? '+' : ''}</span>
          </div>
          <ul className="max-h-56 overflow-auto">
            {filtered.length === 0 && <li className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</li>}
            {filtered.map(u => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => pick(u)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50"
                >
                  <Avatar user={u} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{shortName(u)}</p>
                    <p className="text-xs text-slate-400 truncate font-mono">{u.ci || u.email}</p>
                  </div>
                  {requireCi && !u.ci && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">sin CI</span>}
                  {u.id === value && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
