// ─────────────────────────────────────────────────────────────────────────────
// Plantillas HTML A4 imprimibles de las actas (RF-ACT) — estilo Penguin.
// Basadas en el docx oficial "Plantilla de acta de entrega" + §9.1 del desarrollo.
// El mismo HTML se usa para el preview en iframe y para el PDF de Puppeteer.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const PENGUIN_BLUE = '#1e3a8a';

// Logo embebido como base64 — vive en el repo y se carga 1 sola vez al require().
// Si el archivo no existe, dejamos null y caemos a un texto-placeholder.
let LOGO_DATA_URL = null;
try {
  const logoPath = path.join(__dirname, 'assets', 'logo-penguin.png');
  const buf = fs.readFileSync(logoPath);
  LOGO_DATA_URL = `data:image/png;base64,${buf.toString('base64')}`;
} catch (e) {
  console.warn('actaTemplate: no se pudo cargar el logo —', e.message);
}

const TYPE_TITLE = {
  DELIVERY:   'ACTA DE ENTREGA DE EQUIPO INFORMÁTICO',
  RETURN:     'ACTA DE DEVOLUCIÓN DE EQUIPO INFORMÁTICO',
  RETIREMENT: 'ACTA DE BAJA DE EQUIPO INFORMÁTICO',
};

// Título del acta ajustado al grupo del activo (ej. mousepad → "ACCESORIO").
const TITLE_NOUN = { COMPUTER: 'EQUIPO INFORMÁTICO', PERIPHERAL: 'PERIFÉRICO', ACCESSORY: 'ACCESORIO' };
function titleFor(type, asset) {
  const verb = type === 'DELIVERY' ? 'ENTREGA' : type === 'RETURN' ? 'DEVOLUCIÓN' : 'BAJA';
  return `ACTA DE ${verb} DE ${TITLE_NOUN[groupOf(asset)] || 'EQUIPO INFORMÁTICO'}`;
}

const COND_LABEL = { GOOD: 'Bueno', FAIR: 'Aceptable', POOR: 'Malo', DAMAGED: 'Dañado' };

const esc = (s) => String(s ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })
  : '—';

// Solo mostramos filas que tienen dato (excepto TAG, que siempre va).
// Así el acta de un mousepad no muestra "MAC WiFi: —", "SN: —", etc.
function techTable(asset) {
  const rows = [
    ['TAG / Inventario', asset.tag, true],
    ['Fabricante', asset.brand],
    ['Modelo', asset.model],
    ['Número de serie', asset.serialNumber],
    ['IMEI', asset.imei],
    ['MAC WiFi', asset.macWifi],
    ['MAC Ethernet', asset.macEth],
    ['Sistema operativo', asset.operatingSystem],
    ['Especificaciones', asset.details],
  ].filter(([, v, always]) => always || (v != null && String(v).trim() !== ''));
  return `<table class="tech">
    ${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sustantivo y cláusulas por grupo de categoría
// ─────────────────────────────────────────────────────────────────────────────
// COMPUTER:    equipos con SO administrable (notebook, desktop, phone, tablet)
//              → todas las cláusulas, incluida auditoría/mantenimiento de seguridad.
// PERIPHERAL:  periféricos electrónicos sin SO administrable (monitor, tv, printer,
//              keyboard, mouse). Sin cláusula de mantenimientos/auditorías.
// ACCESSORY:   accesorios pasivos (mousepad, stand). Cláusulas mínimas.
//
// El sustantivo singular ("equipo informático", "periférico", "accesorio") se
// usa también en los textos introductorios y en el acta de devolución.
const CATEGORY_GROUP = {
  notebook: 'COMPUTER', desktop:  'COMPUTER', phone: 'COMPUTER', tablet: 'COMPUTER',
  monitor:  'PERIPHERAL', tv: 'PERIPHERAL', printer: 'PERIPHERAL',
  keyboard: 'PERIPHERAL', mouse: 'PERIPHERAL',
  mousepad: 'ACCESSORY', stand: 'ACCESSORY',
};

const NOUN = {
  COMPUTER:   { sing: 'equipo informático',  art: 'el', the: 'del' },
  PERIPHERAL: { sing: 'periférico',          art: 'el', the: 'del' },
  ACCESSORY:  { sing: 'accesorio',           art: 'el', the: 'del' },
};

function groupOf(asset) {
  return CATEGORY_GROUP[asset?.category?.slug] || 'COMPUTER';
}
function nounOf(asset) {
  return NOUN[groupOf(asset)];
}

const COMMON_CLAUSES = {
  PROPERTY: (n) => `${cap(n.art)} ${n.sing} descripto es propiedad de Penguin Infrastructure S.A. y se entrega exclusivamente para el desempeño de las funciones laborales del receptor.`,
  USE:      (n) => `El receptor se compromete a hacer un uso responsable y diligente ${n.the} ${n.sing}, resguardándolo de daños, pérdidas, robos o usos indebidos.`,
  TRANSFER: (n) => `${cap(n.art)} ${n.sing} no podrá ser cedido, prestado ni transferido a terceros sin autorización expresa del departamento de Networking & Cybersecurity.`,
  REPORT:   (n) => `Cualquier falla, daño o anomalía deberá ser reportada de inmediato al departamento IT mediante el sistema de tickets.`,
  AUDIT:    (n) => `El receptor autoriza al departamento IT a realizar mantenimientos, auditorías y actualizaciones de seguridad sobre ${n.art} ${n.sing} cuando sea necesario.`,
  RETURN:   (n) => `Al cese de la relación laboral o ante requerimiento de la empresa, el receptor deberá devolver ${n.art} ${n.sing} en las condiciones en que lo recibió, salvo el desgaste normal de uso.`,
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function deliveryClauses(asset) {
  const n = nounOf(asset);
  const group = groupOf(asset);
  const keys = group === 'COMPUTER'
    ? ['PROPERTY', 'USE', 'TRANSFER', 'REPORT', 'AUDIT', 'RETURN']
    : group === 'PERIPHERAL'
      ? ['PROPERTY', 'USE', 'TRANSFER', 'REPORT', 'RETURN']            // sin AUDIT
      : ['PROPERTY', 'USE', 'RETURN'];                                  // ACCESSORY: mínimas
  return keys.map(k => COMMON_CLAUSES[k](n));
}

function signatures(acta, { single = false, receptorRole = 'Receptor', extraSigner = null } = {}) {
  // Si receptor y firmante son la misma persona (típico cuando el responsable
  // administrativo del equipo es el propio líder IT), omitimos la firma del
  // receptor — sino el mismo nombre aparece duplicado en el acta.
  const collapse = single || acta.sameReceptorFirmante === true;
  const receptor = `<div class="sign">
      <div class="line"></div>
      <p class="name">${esc(acta.receptorName)}</p>
      <p class="role">${esc(receptorRole)}${acta.receptorCi ? ` · C.I. ${esc(acta.receptorCi)}` : ''}</p>
    </div>`;
  const firmante = `<div class="sign">
      <div class="line"></div>
      <p class="name">${esc(acta.firmanteName)}</p>
      <p class="role">Networking &amp; Cybersecurity Leader · Penguin Infrastructure S.A.</p>
    </div>`;
  const third = extraSigner ? `<div class="sign">
      <div class="line"></div>
      <p class="name">${esc(extraSigner.name)}</p>
      <p class="role">${esc(extraSigner.role || 'Operador responsable')}${extraSigner.ci ? ` · C.I. ${esc(extraSigner.ci)}` : ''}</p>
    </div>` : '';
  return `<div class="signs">${collapse ? firmante + third : receptor + firmante + third}</div>`;
}

// Renderiza la lista de usuarios autorizados de un activo compartido. Se usa en
// el cuerpo del acta de entrega para dejar constancia explícita de quiénes más
// pueden operar el equipo bajo la responsabilidad administrativa del receptor.
function authorizedUsersBlock(acta) {
  const users = acta.authorizedUsers || [];
  if (!users.length) return '';
  return `<h3>Usuarios autorizados a operar el equipo</h3>
    <p class="declare">El presente activo se entrega bajo la modalidad de <strong>equipo compartido</strong>. El receptor arriba indicado es el responsable administrativo del equipo. Quedan autorizados a operarlo, dentro del marco de sus funciones, los siguientes usuarios:</p>
    <table class="tech">
      <tr><th style="width:60%">Nombre</th><th>C.I.</th></tr>
      ${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.ci || '—')}</td></tr>`).join('')}
    </table>`;
}

// Bajas con responsabilidad del usuario: el dueño anterior debe firmar y
// explicar lo que pasó. OBSOLETE es decisión interna de IT (sin firma de user).
const TIPO_BAJA_LABEL = {
  DAMAGE:   'Daño / Avería (DAMAGE)',
  THEFT:    'Robo (THEFT)',
  LOSS:     'Extravío / Pérdida (LOSS)',
  OBSOLETE: 'Obsolescencia / Descarte (OBSOLETE)',
};
const TIPO_BAJA_REQUIERE_FIRMA_USUARIO = new Set(['DAMAGE', 'THEFT', 'LOSS']);

function body(acta) {
  const n = nounOf(acta.asset);
  if (acta.type === 'DELIVERY') {
    const articulo = n.sing === 'accesorio' ? 'un accesorio' : (n.sing === 'periférico' ? 'un periférico' : 'un equipo informático');
    return `
      <p class="declare">Yo, <strong>${esc(acta.receptorName)}</strong> con Cédula de Identidad
      <strong>${esc(acta.receptorCi)}</strong>, en mi calidad de empleado de Penguin Group S.A., por la
      presente, hago constar que en el día <strong>${fmtDate(acta.signedAt)}</strong> he recibido de parte
      de la empresa ${articulo} con la siguiente descripción:</p>
      ${techTable(acta.asset)}
      <h3>Cláusulas de responsabilidad</h3>
      <ol class="clauses">${deliveryClauses(acta.asset).map(c => `<li>${esc(c)}</li>`).join('')}</ol>
      ${authorizedUsersBlock(acta)}
      ${signatures(acta)}`;
  }

  if (acta.type === 'RETURN') {
    const used = acta.daysInUse != null ? `${acta.daysInUse} días` : '—';
    return `
      <p class="declare">Yo, <strong>${esc(acta.receptorName)}</strong>, devuelvo a la empresa ${n.art}
      ${esc(n.sing)} que me fue entregado mediante acta previa. Por la presente hago constar la devolución
      ${n.the} mismo en fecha <strong>${fmtDate(acta.signedAt)}</strong>:</p>
      ${techTable(acta.asset)}
      <h3>Estado ${n.the} ${esc(n.sing)}</h3>
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
  const requiereFirmaUser = TIPO_BAJA_REQUIERE_FIRMA_USUARIO.has(acta.tipoBaja);
  const op = acta.responsibleOperator || null; // sólo viene en bajas de activos compartidos
  const userBlock = requiereFirmaUser && acta.receptorName && !acta.sameReceptorFirmante ? `
    <h3>Declaración del responsable administrativo</h3>
    <p class="declare">Yo, <strong>${esc(acta.receptorName)}</strong>${acta.receptorCi ? ` con Cédula de Identidad <strong>${esc(acta.receptorCi)}</strong>` : ''}, en mi calidad de empleado de Penguin Group S.A. y responsable administrativo del equipo arriba descripto, declaro lo siguiente respecto al hecho que motiva la presente baja:</p>
    <p class="box">${esc(acta.userStatement || acta.observations)}</p>` : '';
  const operatorBlock = requiereFirmaUser && op ? `
    <h3>Declaración del operador responsable del incidente</h3>
    <p class="declare">Yo, <strong>${esc(op.name)}</strong>${op.ci ? ` con Cédula de Identidad <strong>${esc(op.ci)}</strong>` : ''}, en mi calidad de operador autorizado a utilizar el equipo compartido descripto, reconozco haber sido el responsable directo del hecho que motiva la presente baja y declaro lo siguiente:</p>
    <p class="box">${esc(op.statement || '—')}</p>` : '';
  return `
    <p class="declare">El departamento de <strong>Networking &amp; Cybersecurity</strong> de Penguin
    Infrastructure S.A., en fecha <strong>${fmtDate(acta.signedAt)}</strong>, resuelve dar de baja ${n.art}
    ${esc(n.sing)} descripto a continuación, por las razones que se exponen en este acta:</p>
    ${techTable(acta.asset)}
    <h3>Detalle de la baja</h3>
    <table class="tech">
      <tr><th>Tipo de baja</th><td>${esc(TIPO_BAJA_LABEL[acta.tipoBaja] || acta.tipoBaja || '—')}</td></tr>
      <tr><th>Condición final</th><td>${esc(COND_LABEL[acta.conditionAfter] || acta.conditionAfter)}</td></tr>
      ${acta.asset?.shared ? `<tr><th>Modalidad</th><td>Equipo compartido</td></tr>` : ''}
    </table>
    <h3>Motivo de la baja (departamento IT)</h3>
    <p class="box">${esc(acta.observations)}</p>
    ${userBlock}
    ${operatorBlock}
    ${signatures(acta, {
      single: !requiereFirmaUser,
      receptorRole: acta.asset?.shared ? 'Responsable administrativo' : 'Usuario responsable',
      extraSigner: op ? { name: op.name, ci: op.ci, role: 'Operador responsable del incidente' } : null,
    })}`;
}

function renderActaHtml(acta) {
  const title = titleFor(acta.type, acta.asset);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>${esc(acta.number || title)}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm 16mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 10.5px; line-height: 1.38; margin: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${PENGUIN_BLUE}; padding-bottom: 8px; margin-bottom: 12px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand img { height: 30px; width: auto; display: block; }
    .brand .text { font-size: 10px; font-weight: 500; color: #64748b; line-height: 1.3; }
    .brand .text strong { display: block; font-size: 12px; color: ${PENGUIN_BLUE}; font-weight: 700; }
    .docnum { text-align: right; font-size: 10px; color: #64748b; }
    .docnum strong { display:block; font-size: 12px; color: ${PENGUIN_BLUE}; }
    h1 { font-size: 14px; text-align: center; color: ${PENGUIN_BLUE}; letter-spacing: .5px; margin: 0 0 10px; }
    h3 { font-size: 11px; color: ${PENGUIN_BLUE}; margin: 10px 0 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
    .declare { text-align: justify; margin: 0 0 8px; }
    table.tech { width: 100%; border-collapse: collapse; margin: 4px 0; }
    table.tech th, table.tech td { border: 1px solid ${PENGUIN_BLUE}; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 10.5px; }
    table.tech th { background: #eff6ff; width: 32%; font-weight: 600; color: ${PENGUIN_BLUE}; }
    ol.clauses { padding-left: 16px; margin: 4px 0; }
    ol.clauses li { text-align: justify; margin-bottom: 3px; }
    .box { border: 1px solid #cbd5e1; border-radius: 4px; min-height: 28px; padding: 6px 8px; background: #f8fafc; }
    .signs { display: flex; justify-content: space-around; margin-top: 56px; gap: 18px; page-break-inside: avoid; break-inside: avoid; }
    .sign { text-align: center; flex: 1; page-break-inside: avoid; break-inside: avoid; }
    .sign .line { border-top: 1px solid #334155; margin: 0 auto 4px; width: 82%; }
    .sign .name { font-weight: 600; margin: 0; font-size: 10.5px; }
    .sign .role { font-size: 9px; color: #64748b; margin: 1px 0 0; line-height: 1.25; }
    .foot { position: fixed; bottom: 5mm; left: 0; right: 0; text-align: center; font-size: 8.5px; color: #94a3b8; }
  </style></head><body>
    <div class="head">
      <div class="brand">
        ${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Penguin Infrastructure" />` : ''}
        <div class="text"><strong>Penguin Infrastructure S.A.</strong>Sede Hernandarias (PE1H)</div>
      </div>
      <div class="docnum">Acta N.°<strong>${esc(acta.number || '—')}</strong>${fmtDate(acta.signedAt)}</div>
    </div>
    <h1>${title}</h1>
    ${body(acta)}
    <div class="foot">Networking Documents V01-10</div>
  </body></html>`;
}

module.exports = { renderActaHtml, TYPE_TITLE, COND_LABEL };
