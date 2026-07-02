const router = require('express').Router();
const multer = require('multer');
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { computeNextTag } = require('../services/assetTag');
const { buildTemplateBuffer, parseUploadedRows } = require('../services/importXlsx');
const { friendlyPrismaError } = require('../services/prismaError');

const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const _norm = (s) => String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Movimientos manuales permitidos (DEPLOY se reserva para el flujo de despliegue).
const MOVEMENT_REASONS = ['INITIAL', 'PURCHASE', 'CONSUME', 'ADJUST', 'RETURN'];

const ITEM_INCLUDE = { group: { select: { slug: true, name: true } } };

// Aplana flags útiles para el frontend.
function shape(item) {
  return {
    ...item,
    convertible: !!item.categorySlug,
    lowStock: item.minQuantity != null && item.quantity <= item.minQuantity,
  };
}

// ── GET /api/stock (listado con filtros) ───────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { group, type, lowStock, search } = req.query;
    const where = { deletedAt: null };
    if (group) where.groupSlug = group;
    if (type === 'convertible') where.categorySlug = { not: null };
    if (type === 'consumable')  where.categorySlug = null;
    if (search) {
      const s = String(search);
      where.OR = [
        { name:  { contains: s, mode: 'insensitive' } },
        { brand: { contains: s, mode: 'insensitive' } },
        { model: { contains: s, mode: 'insensitive' } },
      ];
    }
    let items = await prisma.stockItem.findMany({ where, include: ITEM_INCLUDE, orderBy: [{ groupSlug: 'asc' }, { name: 'asc' }] });
    items = items.map(shape);
    if (lowStock === 'true') items = items.filter(i => i.lowStock);
    res.json({ items });
  } catch (err) { next(err); }
});

// ── GET /api/stock/:id (detalle + historial de movimientos) ────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await prisma.stockItem.findUnique({ where: { id: req.params.id }, include: ITEM_INCLUDE });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    const movements = await prisma.stockMovement.findMany({
      where: { stockItemId: item.id }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json({ item: shape(item), movements });
  } catch (err) { next(err); }
});

// ── POST /api/stock (alta de ítem) ─────────────────────────────────────────────
router.post('/', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'name es requerido' });
    if (!b.groupSlug) return res.status(400).json({ error: 'groupSlug es requerido' });
    const group = await prisma.stockGroup.findUnique({ where: { slug: b.groupSlug } });
    if (!group) return res.status(400).json({ error: 'Grupo inválido' });
    if (b.categorySlug) {
      const cat = await prisma.assetCategory.findUnique({ where: { slug: b.categorySlug } });
      if (!cat) return res.status(400).json({ error: 'Categoría inválida' });
    }
    const qty = Math.max(0, parseInt(b.quantity, 10) || 0);

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          name: b.name, groupSlug: b.groupSlug, categorySlug: b.categorySlug || null,
          brand: b.brand || null, model: b.model || null,
          unit: b.unit || 'unidad', quantity: qty,
          minQuantity: b.minQuantity != null && b.minQuantity !== '' ? parseInt(b.minQuantity, 10) : null,
          location: b.location || null, notes: b.notes || null,
        },
        include: ITEM_INCLUDE,
      });
      if (qty > 0) {
        await tx.stockMovement.create({ data: { stockItemId: item.id, delta: qty, reason: 'INITIAL', userId: req.user.id, notes: 'Carga inicial' } });
      }
      return item;
    });

    await audit({ req, action: 'CREATE', entityType: 'StockItem', entityId: created.id, after: created });
    res.status(201).json({ item: shape(created) });
  } catch (err) { next(err); }
});

// ── PATCH /api/stock/:id (editar — NO cambia quantity; eso va por movimientos) ──
router.patch('/:id', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const before = await prisma.stockItem.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Ítem no encontrado' });
    if (b.groupSlug) {
      const group = await prisma.stockGroup.findUnique({ where: { slug: b.groupSlug } });
      if (!group) return res.status(400).json({ error: 'Grupo inválido' });
    }
    if (b.categorySlug) {
      const cat = await prisma.assetCategory.findUnique({ where: { slug: b.categorySlug } });
      if (!cat) return res.status(400).json({ error: 'Categoría inválida' });
    }
    const data = {};
    for (const f of ['name', 'groupSlug', 'brand', 'model', 'unit', 'location', 'notes']) {
      if (b[f] !== undefined) data[f] = b[f] || (f === 'unit' ? 'unidad' : null);
    }
    if (b.categorySlug !== undefined) data.categorySlug = b.categorySlug || null;
    if (b.minQuantity !== undefined) data.minQuantity = (b.minQuantity === '' || b.minQuantity == null) ? null : parseInt(b.minQuantity, 10);

    const after = await prisma.stockItem.update({ where: { id }, data, include: ITEM_INCLUDE });
    await audit({ req, action: 'UPDATE', entityType: 'StockItem', entityId: id, before, after });
    res.json({ item: shape(after) });
  } catch (err) { next(err); }
});

// ── POST /api/stock/:id/movement (entrada/salida/ajuste) ───────────────────────
router.post('/:id/movement', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { delta, reason, notes } = req.body;
    const d = parseInt(delta, 10);
    if (!Number.isInteger(d) || d === 0) return res.status(400).json({ error: 'delta debe ser un entero distinto de 0' });
    if (!MOVEMENT_REASONS.includes(reason)) return res.status(400).json({ error: `reason debe ser uno de: ${MOVEMENT_REASONS.join(', ')}` });

    const item = await prisma.stockItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    const nextQty = item.quantity + d;
    if (nextQty < 0) return res.status(409).json({ error: `Stock insuficiente: hay ${item.quantity}, intentás retirar ${Math.abs(d)}.` });

    const after = await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({ data: { stockItemId: id, delta: d, reason, userId: req.user.id, notes: notes || null } });
      return tx.stockItem.update({ where: { id }, data: { quantity: nextQty }, include: ITEM_INCLUDE });
    });

    await audit({ req, action: 'UPDATE', entityType: 'StockItem', entityId: id, before: item, after: { ...after, movement: { delta: d, reason } } });
    res.json({ item: shape(after) });
  } catch (err) { next(err); }
});

// ── DELETE /api/stock/:id (baja lógica) ────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const before = await prisma.stockItem.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Ítem no encontrado' });
    const after = await prisma.stockItem.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ req, action: 'DELETE_LOGICAL', entityType: 'StockItem', entityId: id, before, after });
    res.json({ ok: true, deleted: { id, name: before.name } });
  } catch (err) { next(err); }
});

// ── Importación masiva ─────────────────────────────────────────────────────────
// Crea ítems desde filas (keyed por clave interna). Dedup por nombre+grupo:
// si ya existe un ítem activo con ese nombre en ese grupo, se omite (no duplica).
async function runStockImport(rows, defaultGroupSlug) {
  const [groups, cats] = await Promise.all([
    prisma.stockGroup.findMany({ select: { slug: true, name: true } }),
    prisma.assetCategory.findMany({ select: { slug: true, name: true } }),
  ]);
  const groupBy = {}; groups.forEach(g => { groupBy[_norm(g.slug)] = g.slug; groupBy[_norm(g.name)] = g.slug; });
  const catBy = {};   cats.forEach(c => { catBy[_norm(c.slug)] = c.slug; catBy[_norm(c.name)] = c.slug; });

  const result = { created: 0, skipped: 0, errors: [] };
  for (const [idx, row] of rows.entries()) {
    try {
      const name = String(row.name || '').trim();
      if (!name) { result.skipped++; continue; }
      const groupSlug = groupBy[_norm(row.groupSlug)] || defaultGroupSlug || null;
      if (!groupSlug) { result.errors.push({ row: idx, error: `Grupo desconocido: ${row.groupSlug || '(vacío)'}` }); continue; }
      // Tipo: "Consumible"/vacío → null; sino nombre/slug de categoría de activo.
      let categorySlug = null;
      const t = _norm(row.categorySlug);
      if (t && t !== _norm('Consumible')) {
        categorySlug = catBy[t] || null;
        if (!categorySlug) { result.errors.push({ row: idx, error: `Categoría desconocida: ${row.categorySlug}` }); continue; }
      }
      // Dedup por nombre + marca + modelo + grupo: así varios "Celular" con
      // distinta marca/modelo (Xiaomi, Samsung, iPhone) son ítems DISTINTOS.
      const brand = row.brand ? String(row.brand).trim() : null;
      const model = row.model ? String(row.model).trim() : null;
      const dup = await prisma.stockItem.findFirst({ where: {
        groupSlug, deletedAt: null,
        name:  { equals: name, mode: 'insensitive' },
        brand: brand ? { equals: brand, mode: 'insensitive' } : null,
        model: model ? { equals: model, mode: 'insensitive' } : null,
      } });
      if (dup) { result.skipped++; continue; }

      const qty = Math.max(0, parseInt(row.quantity, 10) || 0);
      const min = (row.minQuantity != null && row.minQuantity !== '') ? parseInt(row.minQuantity, 10) : null;
      await prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.create({
          data: {
            name, groupSlug, categorySlug,
            brand, model,
            unit: row.unit || 'unidad', quantity: qty,
            minQuantity: Number.isNaN(min) ? null : min,
            location: row.location || null, notes: row.notes || null,
          },
        });
        if (qty > 0) await tx.stockMovement.create({ data: { stockItemId: item.id, delta: qty, reason: 'INITIAL', notes: 'Carga inicial (import)' } });
      });
      result.created++;
    } catch (e) { result.errors.push({ row: idx, error: friendlyPrismaError(e) || e.message }); }
  }
  return result;
}

// ── POST /api/stock/import (rows[] ya parseadas) ───────────────────────────────
router.post('/import', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { rows, defaultGroupSlug } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Body debe incluir rows: array' });
    const result = await runStockImport(rows, defaultGroupSlug);
    await audit({ req, action: 'CREATE', entityType: 'StockItem', entityId: 'bulk-import', after: result });
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/stock/import-template (.xlsx con dropdowns) ──────────────────────
router.post('/import-template', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { filename, columns } = req.body;
    if (!Array.isArray(columns) || columns.length === 0) return res.status(400).json({ error: 'columns es requerido' });
    const buf = await buildTemplateBuffer(columns);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${(filename || 'plantilla_almacen').replace(/[^\w.-]/g, '_')}.xlsx"`);
    res.send(buf);
  } catch (err) { next(err); }
});

// ── POST /api/stock/import-file (sube .xlsx lleno) ─────────────────────────────
router.post('/import-file', authenticate, requireRole('IT_ADMIN'), uploadMem.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    const defaultGroupSlug = req.body.defaultGroupSlug || null;
    let columns = [];
    try { columns = JSON.parse(req.body.columns || '[]'); } catch { columns = []; }
    const rows = await parseUploadedRows(req.file.buffer, columns);
    const result = await runStockImport(rows, defaultGroupSlug);
    await audit({ req, action: 'CREATE', entityType: 'StockItem', entityId: 'bulk-import-xlsx', after: result });
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/stock/:id/deploy (convertible → crea un Asset y baja el stock) ───
// Body: campos propios de la unidad (serialNumber, ipManagement, condition,
// locationSlug, displayLocation, internalCode, cameraType, nvrChannel,
// megapixels, ports, role, haMode, haPeerAssetId, status, notes).
const DEPLOY_STRING_FIELDS = ['serialNumber', 'operatingSystem', 'macWifi', 'macEth', 'imei', 'ipManagement', 'displayLocation', 'internalCode', 'nvrChannel', 'cameraType', 'role', 'haMode', 'haPeerAssetId', 'departmentSlug', 'vendor', 'details'];
router.post('/:id/deploy', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const item = await prisma.stockItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    if (!item.categorySlug) return res.status(400).json({ error: 'Este ítem es consumible; no se despliega como activo.' });
    if (item.quantity < 1) return res.status(409).json({ error: 'Sin stock disponible para desplegar.' });

    const category = await prisma.assetCategory.findUnique({ where: { slug: item.categorySlug } });
    if (!category) return res.status(400).json({ error: 'La categoría del ítem no existe.' });

    // El número de serie es único entre activos: chequeo previo con mensaje claro.
    if (b.serialNumber) {
      const dupSn = await prisma.asset.findUnique({ where: { serialNumber: b.serialNumber } });
      if (dupSn) return res.status(409).json({ error: `El número de serie ${b.serialNumber} ya existe (activo ${dupSn.tag}).` });
    }

    const CONDITION_VALUES = ['GOOD', 'FAIR', 'POOR', 'DAMAGED'];
    const STATUS_VALUES = ['AVAILABLE', 'IN_PRODUCTION', 'REPAIR', 'DAMAGED'];

    const out = await prisma.$transaction(async (tx) => {
      const tag = await computeNextTag(category, tx);
      const data = {
        tag, categorySlug: item.categorySlug,
        // brand/model vienen del ítem de stock; el body puede sobrescribir.
        brand: b.brand || item.brand || null,
        model: b.model || item.model || null,
        status: STATUS_VALUES.includes(b.status) ? b.status : 'IN_PRODUCTION',
        condition: CONDITION_VALUES.includes(b.condition) ? b.condition : 'GOOD',
        locationSlug: b.locationSlug || null,
        notes: b.notes || null,
      };
      for (const f of DEPLOY_STRING_FIELDS) if (b[f]) data[f] = b[f];
      if (b.megapixels != null && b.megapixels !== '') data.megapixels = parseInt(b.megapixels, 10) || null;
      if (b.ports != null && b.ports !== '') data.ports = parseInt(b.ports, 10) || null;
      if (b.warrantyUntil) { const d = new Date(b.warrantyUntil); if (!isNaN(d)) data.warrantyUntil = d; }

      const asset = await tx.asset.create({ data });
      const updated = await tx.stockItem.update({ where: { id }, data: { quantity: item.quantity - 1 }, include: ITEM_INCLUDE });
      await tx.stockMovement.create({ data: { stockItemId: id, delta: -1, reason: 'DEPLOY', assetId: asset.id, userId: req.user.id, notes: `Desplegado como ${asset.tag}` } });
      return { asset, item: updated };
    });

    await audit({ req, action: 'CREATE', entityType: 'Asset', entityId: out.asset.id, after: { ...out.asset, deployedFromStock: id } });
    res.status(201).json({ asset: out.asset, item: shape(out.item) });
  } catch (err) {
    if (err.code === 'P2002') {
      const field = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : (err.meta?.target || 'un campo único');
      return res.status(409).json({ error: `Valor duplicado en ${field}. Verificá el número de serie / datos únicos.` });
    }
    next(err);
  }
});

module.exports = router;
