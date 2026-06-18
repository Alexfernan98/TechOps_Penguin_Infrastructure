const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { notify } = require('../services/notify');

// ─────────────────────────────────────────────────────────────────────────────
// Inventario de Activos (RF-INV) — desarrollo.md §5
// ─────────────────────────────────────────────────────────────────────────────

const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const BARCODE_RE = /^\d{6}$/;

function normalizeBarcode(v) {
  if (v == null || v === '') return null;
  return String(v).trim().padStart(6, '0').slice(-6); // permite ingresar "700" → "000700"
}
const STATUS_VALUES    = ['AVAILABLE', 'ASSIGNED', 'LOAN', 'REPAIR', 'DAMAGED', 'RETIRED', 'LOST'];
const CONDITION_VALUES = ['GOOD', 'FAIR', 'POOR', 'DAMAGED'];

const HOLDER_SELECT = {
  id: true, name: true, nameFirst: true, nameLast: true, email: true,
  avatarUrl: true, ci: true,
};

const ASSET_INCLUDE = {
  category: { select: { slug: true, name: true, tagPrefix: true } },
  location: { select: { slug: true, name: true, siteCode: true } },
  assignments: {
    where: { returnedAt: null },
    include: { user: { select: HOLDER_SELECT } },
    orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'desc' }],
  },
};

// Aplana asignaciones activas: el primary va a assignedTo, el resto a
// authorizedUsers. Para activos no-compartidos, authorizedUsers queda vacío.
function shape(a) {
  const active = a.assignments || [];
  const primary = active.find(x => x.isPrimary) || active[0] || null;
  const others  = active.filter(x => x !== primary);
  return {
    ...a,
    assignedTo: primary?.user || null,
    assignedAt: primary?.assignedAt || null,
    authorizedUsers: others.map(x => ({ ...x.user, assignmentId: x.id, assignedAt: x.assignedAt })),
    assignments: undefined,
  };
}

// Próximo TAG correlativo para una categoría (atómico vía transacción en create).
async function computeNextTag(category, tx = prisma) {
  const last = await tx.asset.findFirst({
    where: { categorySlug: category.slug, tag: { startsWith: category.tagPrefix } },
    orderBy: { tag: 'desc' },
    select: { tag: true },
  });
  let next = 1;
  if (last) {
    const m = last.tag.match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${category.tagPrefix}${String(next).padStart(3, '0')}`;
}

// ── GET /assets/next-tag?category= ─────────────────────────────────────────────
router.get('/next-tag', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const cat = await prisma.assetCategory.findUnique({ where: { slug: req.query.category } });
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ nextTag: await computeNextTag(cat) });
  } catch (err) { next(err); }
});

// ── GET /assets/warranty-alerts ────────────────────────────────────────────────
router.get('/warranty-alerts', authenticate, async (_req, res, next) => {
  try {
    const limit = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const assets = await prisma.asset.findMany({
      where: { deletedAt: null, warrantyUntil: { not: null, lte: limit } },
      orderBy: { warrantyUntil: 'asc' },
      select: { id: true, tag: true, brand: true, model: true, warrantyUntil: true },
    });
    res.json({ assets, count: assets.length });
  } catch (err) { next(err); }
});

// ── GET /assets/by-barcode/:code (lookup directo desde el scanner) ─────────────
// Devuelve el activo (con el mismo shape que GET /:id) o 404. Usado por la app
// móvil/scanner para abrir un activo conocido a partir de su etiqueta física.
router.get('/by-barcode/:code', authenticate, async (req, res, next) => {
  try {
    const code = normalizeBarcode(req.params.code);
    if (!code || !BARCODE_RE.test(code)) {
      return res.status(400).json({ error: 'Código de barras inválido (deben ser 6 dígitos)' });
    }
    const asset = await prisma.asset.findUnique({ where: { barcode: code }, include: ASSET_INCLUDE });
    if (!asset) return res.status(404).json({ error: 'No hay activo con ese código', code });
    res.json({ asset: shape(asset) });
  } catch (err) { next(err); }
});

// ── GET /assets/export (CSV con filtros aplicados) ─────────────────────────────
router.get('/export', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const where = buildWhere(req);
    const assets = await prisma.asset.findMany({ where, include: ASSET_INCLUDE, orderBy: { tag: 'asc' } });
    const cols = ['tag', 'categorySlug', 'brand', 'model', 'serialNumber', 'status', 'condition',
      'departmentSlug', 'locationSlug', 'assignedTo', 'warrantyUntil'];
    const head = cols.join(',');
    const lines = assets.map(shape).map(a => cols.map(c => {
      let v = c === 'assignedTo' ? (a.assignedTo?.name || '') : a[c];
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      v = v == null ? '' : String(v);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario_techopshub.csv"');
    res.send([head, ...lines].join('\n'));
  } catch (err) { next(err); }
});

// Construye el filtro Prisma compartido por list y export.
function buildWhere(req) {
  const { category, status, condition, dept, location, user, search, includeInactive, onlyInactive } = req.query;
  const where = {};
  if (onlyInactive === 'true') {
    // Solo dados de baja: lógicas (deletedAt) o por status RETIRED/LOST.
    // Lo metemos en AND para no chocar con el OR de search si está presente.
    where.AND = [{ OR: [{ deletedAt: { not: null } }, { status: { in: ['RETIRED', 'LOST'] } }] }];
  } else if (includeInactive !== 'true') {
    where.deletedAt = null;
  }
  if (category)  where.categorySlug   = category;
  if (status)    where.status         = status;
  if (condition) where.condition      = condition;
  if (dept)      where.departmentSlug = dept;
  if (location)  where.locationSlug   = location;
  if (user)      where.assignments    = { some: { returnedAt: null, userId: user } };

  // EMPLOYEE sólo ve sus propios activos asignados
  if (req.user.role === 'EMPLOYEE') {
    where.assignments = { some: { returnedAt: null, userId: req.user.id } };
  }

  if (search) {
    const s = String(search);
    where.OR = [
      { tag:          { contains: s, mode: 'insensitive' } },
      { barcode:      { contains: s } },
      { brand:        { contains: s, mode: 'insensitive' } },
      { model:        { contains: s, mode: 'insensitive' } },
      { serialNumber: { contains: s, mode: 'insensitive' } },
      { operatingSystem: { contains: s, mode: 'insensitive' } },
      { vendor:       { contains: s, mode: 'insensitive' } },
      { assignments: { some: { returnedAt: null, user: { name: { contains: s, mode: 'insensitive' } } } } },
    ];
  }
  return where;
}

// ── GET /assets (listado paginado con filtros + orden) ─────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'READ_ONLY' || ['IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN', 'EMPLOYEE'].includes(req.user.role)) {
      const where = buildWhere(req);
      const page    = Math.max(1, parseInt(req.query.page || '1', 10));
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage || '15', 10)));
      const SORT_WHITELIST = ['tag', 'brand', 'model', 'serialNumber', 'createdAt',
        'warrantyUntil', 'status', 'condition', 'categorySlug', 'locationSlug'];
      const sortBy  = SORT_WHITELIST.includes(req.query.sortBy) ? req.query.sortBy : 'tag';
      const sortDir = req.query.sortDir === 'desc' ? 'desc' : 'asc';

      const [total, assets] = await Promise.all([
        prisma.asset.count({ where }),
        prisma.asset.findMany({
          where, include: ASSET_INCLUDE,
          orderBy: { [sortBy]: sortDir },
          skip: (page - 1) * perPage, take: perPage,
        }),
      ]);

      return res.json({
        assets: assets.map(shape),
        pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      });
    }
    return res.status(403).json({ error: 'No autorizado' });
  } catch (err) { next(err); }
});

// ── GET /assets/:id (detalle + historial de auditoría + asignaciones) ──────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        ...ASSET_INCLUDE,
        assignments: { include: { user: { select: HOLDER_SELECT }, assignedBy: { select: HOLDER_SELECT } }, orderBy: { assignedAt: 'desc' } },
        actas: {
          select: {
            id: true, type: true, signedAt: true, pdfUrl: true, metadata: true,
            receptor: { select: { id: true, name: true, nameFirst: true, nameLast: true } },
            firmante: { select: { id: true, name: true, nameFirst: true, nameLast: true } },
          },
          orderBy: { signedAt: 'desc' },
        },
      },
    });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    // EMPLOYEE sólo accede a un activo que tenga asignado
    if (req.user.role === 'EMPLOYEE') {
      const isHis = asset.assignments.some(a => a.returnedAt === null && a.userId === req.user.id);
      if (!isHis) return res.status(403).json({ error: 'No autorizado' });
    }

    const history = await prisma.auditLog.findMany({
      where: { entityType: 'Asset', entityId: id },
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { user: { select: { id: true, name: true, nameFirst: true, nameLast: true } } },
    });

    // El detalle trae TODAS las asignaciones (histórico). Para el drawer
    // necesitamos también las activas separadas en primary (assignedTo) y
    // secundarios (authorizedUsers) — espejo de lo que hace shape() en el listado.
    const activeAssignments = asset.assignments.filter(a => a.returnedAt === null);
    activeAssignments.sort((a, b) => (b.isPrimary === true) - (a.isPrimary === true));
    const primaryAssignment = activeAssignments.find(a => a.isPrimary) || activeAssignments[0] || null;
    const others = activeAssignments.filter(a => a !== primaryAssignment);
    const authorizedUsers = others.map(a => ({ ...a.user, assignmentId: a.id, assignedAt: a.assignedAt }));
    // Aplanamos metadata de cada acta a campos top-level (number, statusActa,
    // signedDriveUrl, legacy, tipoBaja) — espejo de lo que hace flatten() en
    // /routes/actas.js. Así el drawer del activo no necesita leer .metadata.
    const flatActas = (asset.actas || []).map(ac => {
      const meta = ac.metadata || {};
      return {
        ...ac,
        number:         meta.number || null,
        statusActa:     meta.status || 'pending_sign',
        signedDriveUrl: meta.signedDriveUrl || null,
        tipoBaja:       meta.tipoBaja || null,
        legacy:         meta.legacy === true,
      };
    });
    res.json({
      asset: {
        ...asset,
        actas: flatActas,
        assignedTo: primaryAssignment?.user || null,
        authorizedUsers,
      },
      history,
    });
  } catch (err) { next(err); }
});

// ── POST /assets (alta con TAG correlativo) ────────────────────────────────────
router.post('/', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.categorySlug) return res.status(400).json({ error: 'categorySlug es requerido' });
    if (b.macWifi && !MAC_RE.test(b.macWifi)) return res.status(400).json({ error: 'MAC WiFi con formato inválido' });
    if (b.macEth  && !MAC_RE.test(b.macEth))  return res.status(400).json({ error: 'MAC Ethernet con formato inválido' });

    const barcode = normalizeBarcode(b.barcode);
    if (barcode && !BARCODE_RE.test(barcode)) return res.status(400).json({ error: 'El código de barras debe ser de 6 dígitos numéricos' });
    if (barcode) {
      const dup = await prisma.asset.findUnique({ where: { barcode } });
      if (dup) return res.status(409).json({ error: `El código de barras ${barcode} ya está en uso por ${dup.tag}` });
    }

    if (b.serialNumber) {
      const dup = await prisma.asset.findUnique({ where: { serialNumber: b.serialNumber } });
      if (dup) return res.status(409).json({ error: `El número de serie ${b.serialNumber} ya existe` });
    }

    const created = await prisma.$transaction(async (tx) => {
      const cat = await tx.assetCategory.findUnique({ where: { slug: b.categorySlug } });
      if (!cat) throw Object.assign(new Error('Categoría no encontrada'), { status: 404 });
      const tag = await computeNextTag(cat, tx);
      return tx.asset.create({
        data: {
          tag,
          barcode,
          categorySlug: b.categorySlug,
          brand: b.brand || null,
          model: b.model || null,
          serialNumber: b.serialNumber || null,
          imei: b.imei || null,
          macWifi: b.macWifi || null,
          macEth: b.macEth || null,
          operatingSystem: b.operatingSystem || null,
          status: ['AVAILABLE', 'REPAIR', 'DAMAGED', 'LOAN'].includes(b.status) ? b.status : 'AVAILABLE',
          condition: ['GOOD', 'FAIR', 'POOR', 'DAMAGED'].includes(b.condition) ? b.condition : 'GOOD',
          locationSlug: b.locationSlug || null,
          departmentSlug: b.departmentSlug || null,
          details: b.details || null,
          vendor: b.vendor || null,
          purchaseDate: b.purchaseDate ? new Date(b.purchaseDate) : null,
          warrantyUntil: b.warrantyUntil ? new Date(b.warrantyUntil) : null,
          accessories: b.accessories || null,
          shared: b.shared === true,
          notes: b.notes || null,
        },
        include: ASSET_INCLUDE,
      });
    });

    await audit({ req, action: 'CREATE', entityType: 'Asset', entityId: created.id, after: created });
    res.status(201).json({ asset: shape(created) });
  } catch (err) { next(err); }
});

// ── PATCH /assets/:id (editar campos; excluye tag y status) ────────────────────
router.patch('/:id', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });

    const b = req.body;
    if (b.macWifi && !MAC_RE.test(b.macWifi)) return res.status(400).json({ error: 'MAC WiFi con formato inválido' });
    if (b.macEth  && !MAC_RE.test(b.macEth))  return res.status(400).json({ error: 'MAC Ethernet con formato inválido' });

    if (b.serialNumber && b.serialNumber !== before.serialNumber) {
      const dup = await prisma.asset.findUnique({ where: { serialNumber: b.serialNumber } });
      if (dup) return res.status(409).json({ error: `El número de serie ${b.serialNumber} ya existe` });
    }

    // Barcode: opcional, único, 6 dígitos. Soporta limpiar el campo enviando "" o null.
    let nextBarcode = before.barcode;
    if (b.barcode !== undefined) {
      const norm = normalizeBarcode(b.barcode);
      if (norm && !BARCODE_RE.test(norm)) return res.status(400).json({ error: 'El código de barras debe ser de 6 dígitos numéricos' });
      if (norm && norm !== before.barcode) {
        const dup = await prisma.asset.findUnique({ where: { barcode: norm } });
        if (dup && dup.id !== id) return res.status(409).json({ error: `El código de barras ${norm} ya está en uso por ${dup.tag}` });
      }
      nextBarcode = norm;
    }

    const FIELDS = ['brand', 'model', 'serialNumber', 'imei', 'macWifi', 'macEth', 'operatingSystem',
      'condition', 'locationSlug', 'departmentSlug', 'details', 'vendor', 'accessories',
      'evidenceFolderUrl', 'notes'];
    const data = {};
    for (const f of FIELDS) if (b[f] !== undefined) data[f] = b[f] || null;
    if (b.shared !== undefined) data.shared = b.shared === true;
    if (b.barcode !== undefined) data.barcode = nextBarcode;
    if (b.purchaseDate  !== undefined) data.purchaseDate  = b.purchaseDate  ? new Date(b.purchaseDate)  : null;
    if (b.warrantyUntil !== undefined) data.warrantyUntil = b.warrantyUntil ? new Date(b.warrantyUntil) : null;
    if (b.lastRevisionDate !== undefined) data.lastRevisionDate = b.lastRevisionDate ? new Date(b.lastRevisionDate) : null;

    const after = await prisma.asset.update({ where: { id }, data, include: ASSET_INCLUDE });
    await audit({ req, action: 'UPDATE', entityType: 'Asset', entityId: id, before, after });
    res.json({ asset: shape(after) });
  } catch (err) { next(err); }
});

// ── PATCH /assets/:id/status (cambio de estado con motivo obligatorio) ─────────
router.patch('/:id/status', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, condition, reason } = req.body;
    if (!status) return res.status(400).json({ error: 'status es requerido' });
    if (!STATUS_VALUES.includes(status)) return res.status(400).json({ error: 'status inválido' });
    if (condition && !CONDITION_VALUES.includes(condition)) return res.status(400).json({ error: 'condición inválida' });
    if (!reason) return res.status(400).json({ error: 'El motivo es obligatorio' });

    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });

    const after = await prisma.$transaction(async (tx) => {
      if (status === 'AVAILABLE') {
        await tx.assetAssignment.updateMany({ where: { assetId: id, returnedAt: null }, data: { returnedAt: new Date() } });
      }
      return tx.asset.update({
        where: { id },
        data: {
          status,
          ...(condition ? { condition } : {}),
          ...(status === 'AVAILABLE' ? { departmentSlug: null } : {}),
        },
        include: ASSET_INCLUDE,
      });
    });

    await audit({ req, action: 'STATUS_CHANGE', entityType: 'Asset', entityId: id, before, after: { ...after, reason } });
    res.json({ asset: shape(after) });
  } catch (err) { next(err); }
});

// ── POST /assets/:id/assign ────────────────────────────────────────────────────
// Para activos NO compartidos: cierra la asignación activa previa y crea una nueva como primary.
// Para activos compartidos: acepta { userId, isPrimary, authorizedUserIds[] }.
//   - userId define el responsable principal (primary). Si ya hay primary distinto, lo demota a no-primary.
//   - authorizedUserIds reemplaza la lista completa de usuarios autorizados secundarios (excluyendo primary).
router.post('/:id/assign', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, departmentSlug, notes, isPrimary, authorizedUserIds } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId es requerido' });

    const [before, target] = await Promise.all([
      prisma.asset.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, departmentSlug: true } }),
    ]);
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });
    if (!target || !target.isActive) return res.status(400).json({ error: 'Usuario destino inválido' });

    if (!before.shared) {
      // Comportamiento original: una sola asignación activa.
      if (before.status === 'ASSIGNED') return res.status(409).json({ error: 'El activo ya está asignado' });
    }

    const after = await prisma.$transaction(async (tx) => {
      if (!before.shared) {
        await tx.assetAssignment.updateMany({ where: { assetId: id, returnedAt: null }, data: { returnedAt: new Date() } });
        await tx.assetAssignment.create({
          data: { assetId: id, userId, assignedById: req.user.id, notes: notes || null, isPrimary: true },
        });
      } else {
        // Shared: gestionar primary + autorizados.
        const makePrimary = isPrimary !== false; // por defecto el nuevo userId es primary
        if (makePrimary) {
          // Demotar primaries existentes.
          await tx.assetAssignment.updateMany({
            where: { assetId: id, returnedAt: null, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        // ¿Existe ya assignment activo para este userId? upsert manual.
        const existing = await tx.assetAssignment.findFirst({ where: { assetId: id, userId, returnedAt: null } });
        if (existing) {
          await tx.assetAssignment.update({ where: { id: existing.id }, data: { isPrimary: makePrimary, notes: notes || existing.notes } });
        } else {
          await tx.assetAssignment.create({
            data: { assetId: id, userId, assignedById: req.user.id, notes: notes || null, isPrimary: makePrimary },
          });
        }
        // Sincronizar autorizados secundarios si vienen en el body.
        if (Array.isArray(authorizedUserIds)) {
          const keep = new Set([userId, ...authorizedUserIds.filter(uid => uid && uid !== userId)]);
          // Cerrar assignments activos de users que ya no están en la lista.
          await tx.assetAssignment.updateMany({
            where: { assetId: id, returnedAt: null, userId: { notIn: Array.from(keep) } },
            data: { returnedAt: new Date() },
          });
          // Crear assignments faltantes para los autorizados nuevos.
          for (const uid of authorizedUserIds) {
            if (!uid || uid === userId) continue;
            const ex = await tx.assetAssignment.findFirst({ where: { assetId: id, userId: uid, returnedAt: null } });
            if (!ex) {
              await tx.assetAssignment.create({
                data: { assetId: id, userId: uid, assignedById: req.user.id, isPrimary: false },
              });
            }
          }
        }
      }
      return tx.asset.update({
        where: { id },
        data: { status: 'ASSIGNED', departmentSlug: departmentSlug || target.departmentSlug || before.departmentSlug },
        include: ASSET_INCLUDE,
      });
    });

    await audit({ req, action: 'ASSIGN', entityType: 'Asset', entityId: id, before, after });
    await notify({
      userId, type: 'ASSIGNMENT',
      title: 'Activo asignado',
      body: `Se te asignó el equipo ${before.tag} (${before.brand || ''} ${before.model || ''}).`.trim(),
      entityType: 'Asset', entityId: id,
      email: { entityPath: '/assets', ctaLabel: 'Ver activo' },
    });
    res.json({ asset: shape(after) });
  } catch (err) { next(err); }
});

// ── POST /assets/:id/unassign (devolución) ─────────────────────────────────────
// Para activos compartidos acepta { userId } para devolver solo a un autorizado.
// Si no se manda userId, se cierran todas las asignaciones (devolución total).
router.post('/:id/unassign', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { condition, notes, userId } = req.body;
    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });

    const after = await prisma.$transaction(async (tx) => {
      const where = { assetId: id, returnedAt: null, ...(userId ? { userId } : {}) };
      await tx.assetAssignment.updateMany({
        where,
        data: { returnedAt: new Date(), ...(notes ? { notes } : {}) },
      });
      // ¿Quedan asignaciones activas? Si es shared y queda al menos una, status sigue ASSIGNED.
      const remaining = await tx.assetAssignment.count({ where: { assetId: id, returnedAt: null } });
      // Si el primary se fue pero quedan secundarios, promover al más antiguo a primary.
      if (remaining > 0) {
        const stillPrimary = await tx.assetAssignment.count({ where: { assetId: id, returnedAt: null, isPrimary: true } });
        if (stillPrimary === 0) {
          const next = await tx.assetAssignment.findFirst({
            where: { assetId: id, returnedAt: null }, orderBy: { assignedAt: 'asc' },
          });
          if (next) await tx.assetAssignment.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }
      const status = remaining > 0 ? 'ASSIGNED' : 'AVAILABLE';
      return tx.asset.update({
        where: { id },
        data: { status, ...(remaining === 0 ? { departmentSlug: null } : {}), ...(condition ? { condition } : {}) },
        include: ASSET_INCLUDE,
      });
    });

    await audit({ req, action: 'UNASSIGN', entityType: 'Asset', entityId: id, before, after });
    res.json({ asset: shape(after) });
  } catch (err) { next(err); }
});

// ── PATCH /assets/:id/retire (baja lógica — nunca borra) ───────────────────────
router.patch('/:id/retire', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['RETIRED', 'LOST'].includes(status)) return res.status(400).json({ error: 'status debe ser RETIRED o LOST' });
    if (!reason) return res.status(400).json({ error: 'El motivo es obligatorio' });

    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });

    const after = await prisma.$transaction(async (tx) => {
      await tx.assetAssignment.updateMany({ where: { assetId: id, returnedAt: null }, data: { returnedAt: new Date() } });
      // Baja lógica: Asset no tiene isActive — el estado retirado + deletedAt marcan la baja.
      return tx.asset.update({
        where: { id },
        data: { status, deletedAt: new Date(), departmentSlug: null },
        include: ASSET_INCLUDE,
      });
    });

    await audit({ req, action: 'DELETE_LOGICAL', entityType: 'Asset', entityId: id, before, after: { ...after, reason } });
    res.json({ asset: shape(after) });
  } catch (err) { next(err); }
});

// ── PATCH /assets/:id/restore (revertir baja lógica) ──────────────────────────
// Devuelve a AVAILABLE un activo dado de baja (deletedAt != null). Útil cuando
// la baja se registró por error o se recuperó el equipo (ej. tras un robo).
router.patch('/:id/restore', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'El motivo de la restauración es obligatorio' });

    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });
    // Aceptamos restaurar tanto bajas lógicas (deletedAt) como activos en
    // estado RETIRED/LOST sin deletedAt (cambios de status manuales).
    const isRetired = before.deletedAt || ['RETIRED', 'LOST'].includes(before.status);
    if (!isRetired) return res.status(409).json({ error: 'El activo no está dado de baja ni en estado retirado' });

    const after = await prisma.asset.update({
      where: { id },
      data: { deletedAt: null, status: 'AVAILABLE' },
      include: ASSET_INCLUDE,
    });
    await audit({ req, action: 'RESTORE', entityType: 'Asset', entityId: id, before, after: { ...after, reason } });
    res.json({ asset: shape(after) });
  } catch (err) { next(err); }
});

// ── DELETE /assets/:id (hard delete — solo IT_ADMIN+) ─────────────────────────
// Modos:
//  - Por default: rechaza con 409 + conteo de historial si tiene vinculaciones.
//    El frontend entonces puede preguntar al usuario y reintentar con cascade=true.
//  - ?cascade=true: borra TODO lo vinculado (asignaciones, actas con sus PDFs,
//    tickets con sus comentarios y CSAT). El AuditLog se preserva con los
//    snapshots before/after — el historial queda en /audit para consulta.
router.delete('/:id', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const cascade = req.query.cascade === 'true';
    const before = await prisma.asset.findUnique({ where: { id }, include: ASSET_INCLUDE });
    if (!before) return res.status(404).json({ error: 'Activo no encontrado' });

    const [assignments, actas, tickets] = await Promise.all([
      prisma.assetAssignment.count({ where: { assetId: id } }),
      prisma.acta.count({ where: { assetId: id } }),
      prisma.ticket.count({ where: { assetId: id } }),
    ]);

    const blockers = [];
    if (assignments) blockers.push(`${assignments} asignación(es) histórica(s)`);
    if (actas)       blockers.push(`${actas} acta(s) vinculada(s)`);
    if (tickets)     blockers.push(`${tickets} ticket(s) vinculado(s)`);

    if (blockers.length > 0 && !cascade) {
      // 409 con detalle — el frontend pregunta y reintentará con cascade=true si el user confirma.
      return res.status(409).json({
        error: 'Este activo tiene historial vinculado.',
        blockers,
        counts: { assignments, actas, tickets },
        suggestion: 'Confirmá que querés eliminar todo el historial vinculado, o cancelá y usá "Dar de baja" para conservarlo activo.',
      });
    }

    // Cascade: snapshot del historial al AuditLog antes de borrar, y borrado en orden seguro.
    await prisma.$transaction(async (tx) => {
      if (cascade) {
        // Snapshot del historial antes de tirarlo, para que quede consultable en /audit.
        const [allAssignments, allActas, allTickets] = await Promise.all([
          tx.assetAssignment.findMany({ where: { assetId: id } }),
          tx.acta.findMany({ where: { assetId: id } }),
          tx.ticket.findMany({ where: { assetId: id }, include: { comments: true, csat: true } }),
        ]);
        if (allAssignments.length) {
          await audit({ req, action: 'DELETE', entityType: 'AssetAssignment', entityId: id, before: allAssignments });
        }
        if (allActas.length) {
          await audit({ req, action: 'DELETE', entityType: 'Acta', entityId: id, before: allActas });
        }
        if (allTickets.length) {
          await audit({ req, action: 'DELETE', entityType: 'Ticket', entityId: id, before: allTickets });
        }

        // Borrar dependencias en orden (FK constraints):
        // 1) Comentarios y CSAT de tickets vinculados.
        const ticketIds = allTickets.map(t => t.id);
        if (ticketIds.length) {
          await tx.ticketComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
          await tx.csatResponse.deleteMany({ where: { ticketId: { in: ticketIds } } });
          await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
        }
        // 2) Actas hijas (RETURN/RETIREMENT que referencian otra acta).
        await tx.acta.deleteMany({ where: { relatedActaId: { in: allActas.map(a => a.id) } } });
        await tx.acta.deleteMany({ where: { assetId: id } });
        // 3) Asignaciones.
        await tx.assetAssignment.deleteMany({ where: { assetId: id } });
      }
      // 4) El activo.
      await tx.asset.delete({ where: { id } });
    });

    await audit({ req, action: 'DELETE', entityType: 'Asset', entityId: id, before: shape(before) });
    res.json({ ok: true, deleted: { id, tag: before.tag }, cascade, cleared: cascade ? { assignments, actas, tickets } : null });
  } catch (err) { next(err); }
});

// ── POST /assets/import (CSV → rows[]; si TAG existe actualiza, si no crea) ─────
router.post('/import', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Body debe incluir rows: array' });

    const result = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (const [idx, row] of rows.entries()) {
      try {
        const tag = String(row.tag || row.TAG || '').trim();
        if (!tag) { result.skipped++; continue; }
        if ((row.macWifi && !MAC_RE.test(row.macWifi)) || (row.macEth && !MAC_RE.test(row.macEth))) {
          result.errors.push({ row: idx, error: 'MAC con formato inválido' }); continue;
        }
        const data = {
          categorySlug: row.categorySlug || 'desktop',
          brand: row.brand || null, model: row.model || null,
          serialNumber: row.serialNumber || null,
          operatingSystem: row.operatingSystem || null,
          macWifi: row.macWifi || null, macEth: row.macEth || null,
          status: row.status || 'AVAILABLE', condition: row.condition || 'GOOD',
          locationSlug: row.locationSlug || null, departmentSlug: row.departmentSlug || null,
          details: row.details || null, vendor: row.vendor || null,
          warrantyUntil: row.warrantyUntil ? new Date(row.warrantyUntil) : null,
        };
        const existing = await prisma.asset.findUnique({ where: { tag } });
        if (existing) { await prisma.asset.update({ where: { tag }, data }); result.updated++; }
        else { await prisma.asset.create({ data: { tag, ...data } }); result.created++; }
      } catch (e) { result.errors.push({ row: idx, error: e.message }); }
    }
    await audit({ req, action: 'CREATE', entityType: 'Asset', entityId: 'bulk-import', after: result });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
