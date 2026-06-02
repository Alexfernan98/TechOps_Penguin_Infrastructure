// ─────────────────────────────────────────────────────────────────────────────
// Plantillas HTML A4 imprimibles de las actas (RF-ACT) — estilo Penguin.
// Basadas en el docx oficial "Plantilla de acta de entrega" + §9.1 del desarrollo.
// El mismo HTML se usa para el preview en iframe y para el PDF de Puppeteer.
// ─────────────────────────────────────────────────────────────────────────────

const PENGUIN_BLUE = '#1e3a8a';

const TYPE_TITLE = {
  DELIVERY:   'ACTA DE ENTREGA DE EQUIPO INFORMÁTICO',
  RETURN:     'ACTA DE DEVOLUCIÓN DE EQUIPO INFORMÁTICO',
  RETIREMENT: 'ACTA DE BAJA DE EQUIPO INFORMÁTICO',
};

const COND_LABEL = { GOOD: 'Bueno', FAIR: 'Aceptable', POOR: 'Malo', DAMAGED: 'Dañado' };

const esc = (s) => String(s ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })
  : '—';

function techTable(asset) {
  const rows = [
    ['TAG / Inventario', asset.tag],
    ['Fabricante', asset.brand],
    ['Modelo', asset.model],
    ['Número de serie', asset.serialNumber],
    ['MAC WiFi', asset.macWifi],
    ['MAC Ethernet', asset.macEth],
    ['Sistema operativo', asset.operatingSystem],
    ['Especificaciones', asset.details],
  ];
  return `<table class="tech">
    ${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
  </table>`;
}

const DELIVERY_CLAUSES = [
  'El equipo descripto es propiedad de Penguin Infrastructure S.A. y se entrega exclusivamente para el desempeño de las funciones laborales del receptor.',
  'El receptor se compromete a hacer un uso responsable y diligente del equipo, resguardándolo de daños, pérdidas, robos o usos indebidos.',
  'El equipo no podrá ser cedido, prestado ni transferido a terceros sin autorización expresa del departamento de Networking & Cybersecurity.',
  'Cualquier falla, daño o anomalía deberá ser reportada de inmediato al departamento IT mediante el sistema de tickets.',
  'El receptor autoriza al departamento IT a realizar mantenimientos, auditorías y actualizaciones de seguridad sobre el equipo cuando sea necesario.',
  'Al cese de la relación laboral o ante requerimiento de la empresa, el receptor deberá devolver el equipo en las condiciones en que lo recibió, salvo el desgaste normal de uso.',
];

function signatures(acta, { single = false } = {}) {
  const receptor = `<div class="sign">
      <div class="line"></div>
      <p class="name">${esc(acta.receptorName)}</p>
      <p class="role">Receptor${acta.receptorCi ? ` · C.I. ${esc(acta.receptorCi)}` : ''}</p>
    </div>`;
  const firmante = `<div class="sign">
      <div class="line"></div>
      <p class="name">${esc(acta.firmanteName)}</p>
      <p class="role">Networking &amp; Cybersecurity Leader · Penguin Infrastructure S.A.</p>
    </div>`;
  return `<div class="signs">${single ? firmante : receptor + firmante}</div>`;
}

function body(acta) {
  if (acta.type === 'DELIVERY') {
    return `
      <p class="declare">Yo, <strong>${esc(acta.receptorName)}</strong> con Cédula de Identidad
      <strong>${esc(acta.receptorCi)}</strong>, en mi calidad de empleado de Penguin Group S.A., por la
      presente, hago constar que en el día <strong>${fmtDate(acta.signedAt)}</strong> he recibido de parte
      de la empresa un equipo informático con la siguiente descripción:</p>
      ${techTable(acta.asset)}
      <h3>Cláusulas de responsabilidad</h3>
      <ol class="clauses">${DELIVERY_CLAUSES.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
      ${signatures(acta)}`;
  }

  if (acta.type === 'RETURN') {
    const used = acta.daysInUse != null ? `${acta.daysInUse} días` : '—';
    return `
      <p class="declare">Yo, <strong>${esc(acta.receptorName)}</strong>, devuelvo a la empresa el equipo
      informático que me fue entregado mediante acta previa. Por la presente hago constar la devolución
      del siguiente equipo en fecha <strong>${fmtDate(acta.signedAt)}</strong>:</p>
      ${techTable(acta.asset)}
      <h3>Estado del equipo</h3>
      <table class="tech">
        <tr><th>Condición al recibir</th><td>${esc(COND_LABEL[acta.conditionBefore] || acta.conditionBefore)}</td></tr>
        <tr><th>Condición al devolver</th><td>${esc(COND_LABEL[acta.conditionAfter] || acta.conditionAfter)}</td></tr>
        <tr><th>Días de uso</th><td>${esc(used)}</td></tr>
      </table>
      <h3>Observaciones del estado de devolución</h3>
      <p class="box">${esc(acta.observations)}</p>
      <h3>Decisión del departamento IT</h3>
      <p class="box">${esc(acta.itDecision)}</p>
      ${signatures(acta)}`;
  }

  // RETIREMENT
  return `
    <p class="declare">El departamento de <strong>Networking &amp; Cybersecurity</strong> de Penguin
    Infrastructure S.A., en fecha <strong>${fmtDate(acta.signedAt)}</strong>, resuelve dar de baja el
    equipo informático descripto a continuación, por las razones que se exponen en este acta:</p>
    ${techTable(acta.asset)}
    <h3>Detalle de la baja</h3>
    <table class="tech">
      <tr><th>Tipo de baja</th><td>${esc(acta.tipoBaja === 'LOST' ? 'Extravío / Robo (LOST)' : 'Descarte (RETIRED)')}</td></tr>
      <tr><th>Condición final</th><td>${esc(COND_LABEL[acta.conditionAfter] || acta.conditionAfter)}</td></tr>
    </table>
    <h3>Motivo de la baja</h3>
    <p class="box">${esc(acta.observations)}</p>
    ${signatures(acta, { single: true })}`;
}

function renderActaHtml(acta) {
  const title = TYPE_TITLE[acta.type] || 'ACTA';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>${esc(acta.number || title)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.5; margin: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${PENGUIN_BLUE}; padding-bottom: 12px; margin-bottom: 18px; }
    .brand { font-size: 20px; font-weight: 800; color: ${PENGUIN_BLUE}; }
    .brand small { display: block; font-size: 11px; font-weight: 500; color: #64748b; }
    .docnum { text-align: right; font-size: 11px; color: #64748b; }
    .docnum strong { display:block; font-size: 13px; color: ${PENGUIN_BLUE}; }
    h1 { font-size: 16px; text-align: center; color: ${PENGUIN_BLUE}; letter-spacing: .5px; margin: 0 0 16px; }
    h3 { font-size: 12px; color: ${PENGUIN_BLUE}; margin: 18px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .declare { text-align: justify; margin: 0 0 12px; }
    table.tech { width: 100%; border-collapse: collapse; margin: 6px 0; }
    table.tech th, table.tech td { border: 1px solid ${PENGUIN_BLUE}; padding: 5px 8px; text-align: left; vertical-align: top; }
    table.tech th { background: #eff6ff; width: 38%; font-weight: 600; color: ${PENGUIN_BLUE}; }
    ol.clauses { padding-left: 18px; margin: 4px 0; }
    ol.clauses li { text-align: justify; margin-bottom: 5px; }
    .box { border: 1px solid #cbd5e1; border-radius: 4px; min-height: 40px; padding: 8px; background: #f8fafc; }
    .signs { display: flex; justify-content: space-around; margin-top: 48px; gap: 32px; }
    .sign { text-align: center; flex: 1; }
    .sign .line { border-top: 1px solid #334155; margin: 0 auto 6px; width: 80%; }
    .sign .name { font-weight: 600; margin: 0; }
    .sign .role { font-size: 10px; color: #64748b; margin: 2px 0 0; }
    .foot { position: fixed; bottom: 6mm; left: 0; right: 0; text-align: center; font-size: 9px; color: #94a3b8; }
  </style></head><body>
    <div class="head">
      <div class="brand">TechOpsHub<small>Penguin Infrastructure S.A. · Sede Hernandarias (PE1H)</small></div>
      <div class="docnum">Acta N.°<strong>${esc(acta.number || '—')}</strong>${fmtDate(acta.signedAt)}</div>
    </div>
    <h1>${title}</h1>
    ${body(acta)}
    <div class="foot">Networking Documents V01-10 · Documento generado por TechOpsHub</div>
  </body></html>`;
}

module.exports = { renderActaHtml, TYPE_TITLE, COND_LABEL };
