// Parseo de CSV robusto: campos entre comillas ("a,b") y delimitador , o ;.
export function parseCsvLine(line, delim = ',') {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

// Convierte CSV crudo a filas (objetos), detectando delimitador y mapeando
// encabezados con headerToKey (label/clave → clave interna).
export function parseCsv(raw, headerToKey = (h) => h) {
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = parseCsvLine(lines[0], delim).map(headerToKey);
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line, delim);
    const row = {};
    headers.forEach((h, i) => { if (h) row[h] = cells[i] ?? ''; });
    return row;
  });
}
