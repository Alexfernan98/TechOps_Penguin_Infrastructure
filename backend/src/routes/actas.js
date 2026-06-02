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
  asset:    { select: ASSET_SELECT },
  receptor: { select: PERSON_SELECT },
  firmante: { select: PERSON_SELECT },
};

const ACTA_TYPES = ['DELIVERY', 'RETURN', 'RETIREMENT'];

function flatten(acta) {
  const meta = acta.metadata || {};
  return { ...acta, number: meta.number || null, statusActa: meta.status || 'pending_sign', tipoBaja: meta.tipoBaja || null, signedDriveUrl: meta.signedDriveUrl || null };
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
  };
}

async function nextActaNumber(tx, year) {
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end   = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const count = await tx.acta.count({ where: { createdAt: { gte: start, lt: end } } });
  return `ACTA-${year}-${String(count + 1).padStart(4, '0')}`;
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
      // No hay receptor: el firmante IT es el único firmante.
      receptorId = firmanteId;
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

    const created = await prisma.$transaction(async (tx) => {
      const number = await nextActaNumber(tx, new Date().getFullYear());
      return tx.acta.create({
        data: {
          type: b.type, assetId: b.assetId, receptorId, firmanteId,
          relatedActaId: b.relatedActaId || null,
          conditionBefore: b.conditionBefore || null,
          conditionAfter: b.conditionAfter || asset.condition,
          daysInUse,
          observations: b.observations || b.motivoBaja || null,
          itDecision: b.itDecision || null,
          metadata: { number, status: 'pending_sign', tipoBaja: b.tipoBaja || null },
        },
        include: ACTA_INCLUDE,
      });
    });

    await audit({ req, action: 'CREATE', entityType: 'Acta', entityId: created.id, after: created });
    res.status(201).json({ acta: flatten(created) });
  } catch (err) { next(err); }
});

// ── POST /actas/:id/upload-signed (PDF firmado → ./uploads o Drive) ────────────
router.post('/:id/upload-signed', authenticate, requireRole('IT_TECH'), upload.single('file'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const acta = await prisma.acta.findUnique({ where: { id }, include: ACTA_INCLUDE });
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    const meta = { ...(acta.metadata || {}) };
    meta.status = 'signed';
    if (req.body.driveUrl) meta.signedDriveUrl = req.body.driveUrl;     // override / link a Drive
    if (req.file) meta.signedFileName = req.file.filename;
    // En producción: subir req.file a Google Drive (DRIVE_ACTAS_FOLDER_ID) y guardar sólo signedDriveUrl.

    const pdfUrl = meta.signedDriveUrl || (req.file ? `/uploads/actas/${req.file.filename}` : acta.pdfUrl);
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

module.exports = router;
