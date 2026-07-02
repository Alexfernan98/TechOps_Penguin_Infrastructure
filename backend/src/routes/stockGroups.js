const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

function slugify(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// ── GET /api/stock-groups ──────────────────────────────────────────────────────
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const groups = await prisma.stockGroup.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    res.json({ groups });
  } catch (err) { next(err); }
});

// ── POST /api/stock-groups ─────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'name es requerido' });
    const slug = slugify(req.body.slug || name);
    if (!slug) return res.status(400).json({ error: 'slug inválido' });
    const dup = await prisma.stockGroup.findUnique({ where: { slug } });
    if (dup) return res.status(409).json({ error: `Ya existe un grupo con el código ${slug}` });

    const created = await prisma.stockGroup.create({ data: { slug, name, sortOrder: sortOrder ?? 0 } });
    await audit({ req, action: 'CREATE', entityType: 'StockGroup', entityId: created.slug, after: created });
    res.status(201).json({ group: created });
  } catch (err) { next(err); }
});

// ── PATCH /api/stock-groups/:slug ──────────────────────────────────────────────
router.patch('/:slug', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { name, sortOrder, isActive } = req.body;
    const before = await prisma.stockGroup.findUnique({ where: { slug } });
    if (!before) return res.status(404).json({ error: 'Grupo no encontrado' });
    const after = await prisma.stockGroup.update({
      where: { slug },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await audit({ req, action: 'UPDATE', entityType: 'StockGroup', entityId: slug, before, after });
    res.json({ group: after });
  } catch (err) { next(err); }
});

// ── DELETE /api/stock-groups/:slug (bloquea si tiene ítems) ────────────────────
router.delete('/:slug', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const before = await prisma.stockGroup.findUnique({ where: { slug } });
    if (!before) return res.status(404).json({ error: 'Grupo no encontrado' });
    const items = await prisma.stockItem.count({ where: { groupSlug: slug, deletedAt: null } });
    if (items > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: el grupo tiene ${items} ítem(s).`,
        suggestion: 'Reasigná esos ítems a otro grupo antes de eliminarlo.',
      });
    }
    await prisma.stockGroup.delete({ where: { slug } });
    await audit({ req, action: 'DELETE', entityType: 'StockGroup', entityId: slug, before });
    res.json({ ok: true, deleted: { slug, name: before.name } });
  } catch (err) { next(err); }
});

module.exports = router;
