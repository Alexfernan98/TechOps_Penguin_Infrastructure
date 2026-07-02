const ExcelJS = require('exceljs');

// Genera un .xlsx con encabezados legibles + listas desplegables (data
// validation) en las columnas que traen `options`. columns: [{ key, label, options? }].
async function buildTemplateBuffer(columns) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Datos');
  const hidden = wb.addWorksheet('_listas'); hidden.state = 'veryHidden';

  ws.columns = columns.map(c => ({ header: c.label || c.key, key: c.key, width: Math.max(14, (c.label || c.key).length + 2) }));
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF1E3A8A' } };
  headerRow.alignment = { vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  columns.forEach((c, i) => {
    if (!Array.isArray(c.options) || c.options.length === 0) return;
    const colLetter = ws.getColumn(i + 1).letter;
    const listCol = hidden.getColumn(i + 1);
    c.options.forEach((opt, r) => { hidden.getCell(r + 1, i + 1).value = opt; });
    // Referencia ABSOLUTA ($): sin los $, Excel/Sheets desplaza el rango una
    // fila por cada fila de datos y la lista va perdiendo valores hacia abajo.
    const ref = `$${listCol.letter}$1:$${listCol.letter}$${c.options.length}`;
    for (let row = 2; row <= 501; row++) {
      ws.getCell(`${colLetter}${row}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`_listas!${ref}`],
        showErrorMessage: true, errorStyle: 'warning',
        error: 'Elegí un valor de la lista.', errorTitle: 'Valor no válido',
      };
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Valor legible de una celda ExcelJS (maneja richText, formula, hyperlink, fecha).
function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.text != null) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if (v.result != null) return v.result;
    if (v.value != null) return v.value;
    return '';
  }
  return v;
}

// Parsea un buffer xlsx a filas keyed por clave interna, mapeando los
// encabezados (etiqueta o key, normalizados) con el `columns` spec.
async function parseUploadedRows(buffer, columns) {
  const _norm = (s) => String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const headerIdx = {};
  for (const c of (columns || [])) { if (c.label) headerIdx[_norm(c.label)] = c.key; headerIdx[_norm(c.key)] = c.key; }
  const toKey = (h) => headerIdx[_norm(h)] || String(h || '').trim();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find(s => s.state !== 'veryHidden') || wb.worksheets[0];
  if (!ws) return [];

  const colKey = {};
  ws.getRow(1).eachCell((cell, col) => { const k = toKey(cellText(cell.value)); if (k) colKey[col] = k; });

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    row.eachCell((cell, col) => { const k = colKey[col]; if (k) obj[k] = cellText(cell.value); });
    if (Object.values(obj).some(v => v != null && String(v).trim() !== '')) rows.push(obj);
  });
  return rows;
}

module.exports = { buildTemplateBuffer, cellText, parseUploadedRows };
