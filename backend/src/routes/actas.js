const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { notify, notifyRole } = require('../services/notify');
const { renderActaHtml } = require('../services/actaTemplate');

// ─────────────────────────────────────────────────────────────────────────────
// Actas de Entrega / Devolución / Baja (RF-ACT) — desarrollo.md §9
// number y status viven en metadata (Json) → sin cambios de schema.
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '../../uploads/actas');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.id}${path.extname(file.originalname) || '.pdf'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const PERSON_SELECT = { id: true, name: true, nameFirst: true, nameLast: true, email: true, ci: true, avatarUrl: true };
const ASSET_SELECT  = {
  id: true, tag: true, brand: true, model: true, serialNumber: true,
  macWifi: true, macEth: true, operatingSystem: true, details: true,
};
const ACTA_INCLUDE = {
  asset:    { select: { ...ASSET_SELECT, category: { select: { slug: true, name: true } } } },
  receptor: { select: PERSON_SELECT },
  firmante: { select: PERSON_SELECT },
};

const ACTA_TYPES   = ['DELIVERY', 'RETURN', 'RETIREMENT'];
const TIPO_BAJA    = ['DAMAGE', 'THEFT', 'LOSS', 'OBSOLETE'];

// Prefijo corto por tipo: códigos de 3 letras alineados al lenguaje del usuario.
const TYPE_PREFIX  = { DELIVERY: 'ENT', RETURN: 'DEV', RETIREMENT: 'BAJ' };
const TYPE_VERBOSE = { DELIVERY: 'ENTREGA', RETURN: 'DEVOLUCION', RETIREMENT: 'BAJA' };

// Extrae el sufijo legible del TAG completo:
//   PE1H-IT-MON-001  →  MON-001
//   PE1H-IT-PC-012   →  PC-012
// Si no podemos parsear, devolvemos el TAG entero como fallback.
function shortTagSuffix(tag) {
  if (!tag) return '';
  const parts = tag.split('-');
  return parts.length >= 2 ? parts.slice(-2).join('-') : tag;
}

// Slugifica un nombre para usar en el nombre del archivo PDF:
//   "Lorenzo Antonio Martínez"  →  "lorenzo-antonio-martinez"
function slugifyName(name) {
  if (!name) return '';
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function flatten(acta) {
  const meta = acta.metadata || {};
  return {
    ...acta,
    number:          meta.number || null,
    displayName:     meta.displayName || null,
    statusActa:      meta.status || 'pending_sign',
    tipoBaja:        meta.tipoBaja || null,
    userStatement:   meta.userStatement || null,
    signedDriveUrl:  meta.signedDriveUrl || null,
  };
}

function actaView(acta) {
  const meta = acta.metadata || {};
  return {
    type: acta.type, number: meta.number, signedAt: acta.signedAt,
    receptorName: acta.receptor?.name, receptorCi: acta.receptor?.ci,
    firmanteName: acta.firmante?.name,
    conditionBefore: acta.conditionBefore, conditionAfter: acta.conditionAfter,
    daysInUse: acta.daysInUse, observations: acta.observations,
    itDecision: acta.itDecision, tipoBaja: meta.tipoBaja, asset: acta.asset,
    userStatement: meta.userStatement || null,
  };
}

// Calcula el próximo número correlativo por tipo + año.
// Ejemplo: ENT-2026-0001, DEV-2026-0001, BAJ-2026-0001 corren contadores independientes.
async function nextActaNumber(tx, type, year, asset) {
  const prefix = TYPE_PREFIX[type];
  const start  = new Date(`${year}-01-01T00:00:00.000Z`);
  const end    = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  // Filtra por tipo Y por prefijo en metadata.number (cuando hay actas viejas con
  // formato ACTA-YYYY-NNNN, no las contamos para el nuevo correlativo).
  const sameTypeYear = await tx.acta.findMany({
    where: { type, createdAt: { gte: start, lt: end } },
    select: { metadata: true },
  });
  const taken = sameTypeYear
    .map(a => (a.metadata?.number || '').match(new RegExp(`^${prefix}-${year}-(\\d+)-`)))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));
  const next = (taken.length ? Math.max(...taken) : 0) + 1;
  const seq  = String(next).padStart(4, '0');

  // Sufijo TAG ej. MON-001. Si el activo no existe (caso raro), usamos 'NO-TAG'.
  const tagSuffix = shortTagSuffix(asset?.tag) || 'NO-TAG';
  return `${prefix}-${year}-${seq}-${tagSuffix}`;
}

// Construye el nombre del PDF / archivo subido.
//   ENT/DEV: ACTA-ENTREGA-MON-001-2026-06-15-lorenzo-martinez
//   BAJ:     ACTA-BAJA-DAMAGE-MON-001-2026-06-15        (sin persona)
function buildDisplayName({ type, asset, receptor, tipoBaja, date }) {
  const tagSuffix = shortTagSuffix(asset?.tag) || 'NO-TAG';
  const ymd = new Date(date || Date.now()).toISOString().slice(0, 10);
  const head = `ACTA-${TYPE_VERBOSE[type]}`;
  if (type === 'RETIREMENT') {
    return [head, tipoBaja || 'OBSOLETE', tagSuffix, ymd].join('-');
  }
  const personSlug = slugifyName(receptor?.name) || 'receptor';
  return [head, tagSuffix, ymd, personSlug].join('-');
}

// ── GET /actas (listado paginado) ──────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, status, receptorId, assetId, search, dateFrom, dateTo } = req.query;
    const where = {};
    if (type)       where.type = type;
    if (receptorId) where.receptorId = receptorId;
    if (assetId)    where.assetId = assetId;
    if (dateFrom || dateTo) {
      where.signedAt = {};
      if (dateFrom) where.signedAt.gte = new Date(dateFrom);
      if (dateTo)   where.signedAt.lte = new Date(dateTo);
    }
    // EMPLOYEE sólo ve sus propias actas
    if (req.user.role === 'EMPLOYEE') where.receptorId = req.user.id;

    let actas = await prisma.acta.findMany({ where, include: ACTA_INCLUDE, orderBy: { signedAt: 'desc' } });
    actas = actas.map(flatten);
    if (status) actas = actas.filter(a => a.statusActa === status);
    if (search) {
      const s = String(search).toLowerCase();
      actas = actas.filter(a => [a.number, a.asset?.tag, a.receptor?.name].some(v => (v || '').toLowerCase().includes(s)));
    }
    res.json({ actas });
  } catch (err) { next(err); }
});

// ── GET /actas/:id ─────────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const acta = await prisma.acta.findUnique({ where: { id: req.params.id }, include: ACTA_INCLUDE });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });
    if (req.user.role === 'EMPLOYEE' && acta.receptorId !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    res.json({ acta: flatten(acta) });
  } catch (err) { next(err); }
});

// ── GET /actas/:id/preview-html (para iframe del drawer) ───────────────────────
router.get('/:id/preview-html', authenticate, async (req, res, next) => {
  try {
    const acta = await prisma.acta.findUnique({ where: { id: req.params.id }, include: ACTA_INCLUDE });
    if (!acta) return res.status(404).send('Acta no encontrada');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderActaHtml(actaView(acta)));
  } catch (err) { next(err); }
});

// ── GET /actas/:id/pdf (Puppeteer al vuelo) ────────────────────────────────────
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const acta = await prisma.acta.findUnique({ where: { id: req.params.id }, include: ACTA_INCLUDE });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    const meta = acta.metadata || {};
    // Si ya hay PDF firmado guardado, servir ese.
    const signedPath = path.join(UPLOAD_DIR, `${acta.id}.pdf`);
    if (meta.status === 'signed' && fs.existsSync(signedPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      return fs.createReadStream(signedPath).pipe(res);
    }

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      // En contenedores ARM64 el chrome bundled de puppeteer es x86 y crashea con
      // rosetta error. Usamos el chromium del sistema (Alpine: /usr/bin/chromium-browser)
      // vía PUPPETEER_EXECUTABLE_PATH. Si la env var no está, dejamos que puppeteer
      // intente con el bundled (útil en dev local fuera de Docker).
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(renderActaHtml(actaView(acta)), { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${meta.number || acta.id}.pdf"`);
      res.send(pdf);
    } finally {
      await browser.close();
    }
  } catch (err) { next(err); }
});

// ── POST /actas (crear registro pending_sign) ──────────────────────────────────
router.post('/', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!ACTA_TYPES.includes(b.type)) return res.status(400).json({ error: 'type inválido' });
    if (!b.assetId) return res.status(400).json({ error: 'assetId es requerido' });

    const asset = await prisma.asset.findUnique({ where: { id: b.assetId } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    const firmanteId = b.firmanteId || req.user.id;
    let receptorId = b.receptorId;

    if (b.type === 'RETIREMENT') {
      // Por defecto el receptor del acta es el propio IT (acta interna).
      // Excepción: bajas por DAMAGE/THEFT/LOSS deben llevar firma del usuario
      // que tenía el equipo asignado — lo buscamos automáticamente. Si vino
      // un receptorId explícito en el body, lo respetamos.
      const tipo = (b.tipoBaja || '').toUpperCase();
      if (['DAMAGE', 'THEFT', 'LOSS'].includes(tipo)) {
        if (b.receptorId) {
          receptorId = b.receptorId;
        } else {
          const lastAssign = await prisma.assetAssignment.findFirst({
            where: { assetId: b.assetId },
            orderBy: { assignedAt: 'desc' },
            select: { userId: true },
          });
          receptorId = lastAssign?.userId || firmanteId;
        }
      } else {
        receptorId = firmanteId;
      }
    } else {
      if (!receptorId) return res.status(400).json({ error: 'receptorId es requerido' });
      const receptor = await prisma.user.findUnique({ where: { id: receptorId }, select: { ci: true, name: true } });
      if (!receptor) return res.status(404).json({ error: 'Receptor no encontrado' });
      // RF-ACT-060: bloquear emisión si el receptor no tiene CI cargada.
      if (!receptor.ci) {
        return res.status(422).json({ error: `${receptor.name} no tiene CI cargada. Cargá la cédula en Usuarios antes de emitir el acta.`, code: 'NO_CI' });
      }
    }

    // Días de uso para devoluciones (desde la última entrega del activo a este receptor).
    let daysInUse = b.daysInUse ?? null;
    if (b.type === 'RETURN' && daysInUse == null) {
      const lastAssign = await prisma.assetAssignment.findFirst({
        where: { assetId: b.assetId, userId: receptorId },
        orderBy: { assignedAt: 'desc' },
      });
      if (lastAssign) daysInUse = Math.max(0, Math.round((Date.now() - new Date(lastAssign.assignedAt)) / 86400000));
    }

    // Validar tipoBaja solo para RETIREMENT.
    let tipoBaja = null;
    if (b.type === 'RETIREMENT') {
      tipoBaja = (b.tipoBaja || '').toUpperCase();
      if (!TIPO_BAJA.includes(tipoBaja)) {
        return res.status(400).json({
          error: `tipoBaja debe ser uno de: ${TIPO_BAJA.join(', ')}`,
          received: b.tipoBaja,
        });
      }
    }

    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const number = await nextActaNumber(tx, b.type, now.getFullYear(), asset);
      // Para displayName necesitamos los datos del receptor (a menos que sea baja).
      // Para RETIREMENT con firma de usuario (DAMAGE/THEFT/LOSS) también
      // queremos el nombre — buildDisplayName lo ignora para BAJ pero el dato
      // queda disponible para futuros usos.
      const receptor = (b.type === 'RETIREMENT' && receptorId === firmanteId)
        ? null
        : await tx.user.findUnique({ where: { id: receptorId }, select: { name: true } });
      const displayName = buildDisplayName({ type: b.type, asset, receptor, tipoBaja, date: now });

      return tx.acta.create({
        data: {
          type: b.type, assetId: b.assetId, receptorId, firmanteId,
          relatedActaId: b.relatedActaId || null,
          conditionBefore: b.conditionBefore || null,
          conditionAfter: b.conditionAfter || asset.condition,
          daysInUse,
          observations: b.observations || b.motivoBaja || null,
          itDecision: b.itDecision || null,
          metadata: {
            number, displayName, status: 'pending_sign', tipoBaja,
            userStatement: b.userStatement || null,
          },
        },
        include: ACTA_INCLUDE,
      });
    });

    await audit({ req, action: 'CREATE', entityType: 'Acta', entityId: created.id, after: created });
    res.status(201).json({ acta: flatten(created) });
  } catch (err) { next(err); }
});

// ── POST /actas/:id/upload-signed (PDF firmado → Drive del usuario logueado) ────
router.post('/:id/upload-signed', authenticate, requireRole('IT_TECH'), upload.single('file'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const acta = await prisma.acta.findUnique({ where: { id }, include: ACTA_INCLUDE });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    const meta = { ...(acta.metadata || {}) };
    meta.status = 'signed';

    // Si vino un link de Drive manual, lo respetamos (override).
    if (req.body.driveUrl) {
      meta.signedDriveUrl = req.body.driveUrl;
    }

    // Si vino un archivo, intentamos subirlo a Drive (carpeta según tipo de acta).
    // Si Drive no está configurado o falla, caemos al guardado local como fallback.
    if (req.file) {
      const { folderForType, uploadToFolder } = require('../services/drive');
      const folderId = folderForType(acta.type);
      const fs   = require('fs');
      const path = require('path');
      const localPath = path.join(__dirname, '../../uploads/actas', req.file.filename);

      if (folderId && !meta.signedDriveUrl) {
        try {
          const fileName = `${meta.displayName || meta.number || acta.id}.pdf`;
          const stream = fs.createReadStream(localPath);
          const uploaded = await uploadToFolder(req.user.id, folderId, {
            name: fileName,
            mimeType: req.file.mimetype || 'application/pdf',
            stream,
            year: new Date(acta.signedAt || Date.now()).getFullYear(),
            categoryName: acta.asset?.category?.name || 'Otros',
            userEmail: req.user.email,
          });
          meta.signedDriveUrl  = uploaded.webViewLink;
          meta.signedDriveFileId = uploaded.id;
          meta.signedDriveName  = uploaded.name;
          // El archivo ya está en Drive — borramos la copia local para no duplicar storage.
          try { fs.unlinkSync(localPath); } catch (e) { /* noop */ }
          meta.signedFileName = null;
        } catch (e) {
          // Si Drive falla, dejamos el archivo en /uploads como fallback y avisamos.
          console.warn('Drive upload falló, queda guardado local:', e.message);
          meta.signedFileName = req.file.filename;
          meta.driveUploadError = e.message;
        }
      } else {
        // Sin Drive configurado: guardado local clásico.
        meta.signedFileName = req.file.filename;
      }
    }

    const pdfUrl = meta.signedDriveUrl
      || (meta.signedFileName ? `/uploads/actas/${meta.signedFileName}` : acta.pdfUrl);
    const after = await prisma.acta.update({
      where: { id }, data: { metadata: meta, pdfUrl }, include: ACTA_INCLUDE,
    });

    await audit({ req, action: 'UPDATE', entityType: 'Acta', entityId: id, before: acta, after });
    // Notificar a IT_ADMIN + receptor que el acta quedó firmada.
    await notify({
      userId: acta.receptorId, type: 'ACTA',
      title: 'Acta firmada disponible',
      body: `El acta ${meta.number} del equipo ${acta.asset?.tag} fue firmada y subida.`,
      entityType: 'Acta', entityId: id,
      email: { entityPath: '/actas', ctaLabel: 'Ver acta' },
    });
    await notifyRole('IT_ADMIN', {
      type: 'ACTA', title: 'Acta firmada subida',
      body: `Acta ${meta.number} (${acta.type}) del equipo ${acta.asset?.tag} firmada.`,
      entityType: 'Acta', entityId: id,
    });

    res.json({ acta: flatten(after) });
  } catch (err) { next(err); }
});

// ── DELETE /actas/:id (solo IT_ADMIN+) ─────────────────────────────────────────
// Permite borrar actas (típicamente las de prueba). Hace snapshot completo al
// AuditLog antes y elimina el PDF firmado del filesystem si vive en /uploads.
router.delete('/:id', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const before = await prisma.acta.findUnique({ where: { id }, include: ACTA_INCLUDE });
    if (!before) return res.status(404).json({ error: 'Acta no encontrada' });

    // Si hay un PDF firmado guardado localmente, lo borramos del disco.
    const meta = before.metadata || {};
    if (meta.signedFileName) {
      const path = require('path');
      const fs   = require('fs');
      const filePath = path.join(__dirname, '../../uploads/actas', meta.signedFileName);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
      catch (e) { console.warn('No se pudo borrar el PDF del disco:', e.message); }
    }

    // Si esta acta tiene actas "hijas" (RETURN/RETIREMENT que la referencian via
    // relatedActaId), las desvinculamos para no romper la FK.
    await prisma.acta.updateMany({ where: { relatedActaId: id }, data: { relatedActaId: null } });

    await prisma.acta.delete({ where: { id } });
    await audit({ req, action: 'DELETE', entityType: 'Acta', entityId: id, before: flatten(before) });
    res.json({ ok: true, deleted: { id, number: meta.number || null } });
  } catch (err) { next(err); }
});

module.exports = router;
