import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';

// Header de columna ordenable. Resalta dirección y campo activos.
// Uso: <SortableTh sort={sort} by="campo" onClick={toggleSort}>Título</SortableTh>
export function SortableTh({ sort, by, onClick, children, className = '' }) {
  const active = sort?.by === by;
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-4 py-3 cursor-pointer select-none ${className}`} onClick={() => onClick(by)}>
      <span className={`inline-flex items-center gap-1 ${active ? 'text-blue-600' : ''}`}>
        {children}
        <Icon className="w-3 h-3" />
      </span>
    </th>
  );
}

// Select de filtro con placeholder "todas / cualquier ..." y botón ✕ para
// limpiar el valor sin tener que volver a abrir el dropdown.
// options: [{ value, label }]
export function FilterSelect({ value, onChange, placeholder, options, className = '' }) {
  const has = !!value;
  return (
    <div className={`relative w-full md:w-auto ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={has ? { appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'none' } : undefined}
        className={`w-full md:w-auto pl-3 ${has ? 'pr-8' : 'pr-3'} py-2 border ${has ? 'border-blue-400 text-blue-700 bg-blue-50/30' : 'border-slate-200'} rounded-lg text-sm`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {has && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-blue-100 text-blue-600"
          title="Quitar filtro"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Botón verde "Limpiar todo" — usar al final de la barra de filtros.
export function ClearFiltersButton({ onClick, label = 'Limpiar todo' }) {
  return (
    <button onClick={onClick} className="col-span-2 md:col-auto px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
      {label}
    </button>
  );
}
