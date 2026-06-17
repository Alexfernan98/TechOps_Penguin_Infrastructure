const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

// Calcula el próximo TAG correlativo para una categoría
async function computeNextTag(category) {
  const last = await prisma.asset.findFirst({
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

router.get('/', authenticate, async (_req, res, next) => {
  try {
    const cats = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
    });
    const enriched = await Promise.all(cats.map(async (c) => ({
      slug: c.slug, name: c.name, tagPrefix: c.tagPrefix, icon: c.icon,
      isActive: c.isActive, assetCount: c._count.assets,
      nextTag: await computeNextTag(c),
    })));
    res.json({ categories: enriched });
  } catch (err) { next(err); }
});

router.get('/:slug/next-tag', authenticate, async (req, res, next) => {
  try {
    const cat = await prisma.assetCategory.findUnique({ where: { slug: req.params.slug } });
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ nextTag: await computeNextTag(cat) });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { slug, name, tagPrefix, icon } = req.body;
    if (!slug || !name || !tagPrefix) {
      return res.status(400).json({ error: 'slug, name y tagPrefix son requeridos' });
    }
    const created = await prisma.assetCategory.create({ data: { slug, name, tagPrefix, icon: icon || null } });
    await audit({ req, action: 'CREATE', entityType: 'AssetCategory', entityId: created.slug, after: created });
    res.status(201).json({ category: created });
  } catch (err) { next(err); }
});

router.patch('/:slug', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const before = await prisma.assetCategory.findUnique({ where: { slug } });
    if (!before) return res.status(404).json({ error: 'Categoría no encontrada' });
    const { name, tagPrefix, icon, isActive } = req.body;
    const after = await prisma.assetCategory.update({
      where: { slug },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(tagPrefix !== undefined ? { tagPrefix } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await audit({ req, action: 'UPDATE', entityType: 'AssetCategory', entityId: slug, before, after });
    res.json({ category: after });
  } catch (err) { next(err); }
});

// ── DELETE /api/asset-categories/:slug ──────────────────────────────────────────
router.delete('/:slug', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const before = await prisma.assetCategory.findUnique({ where: { slug } });
    if (!before) return res.status(404).json({ error: 'Categoría no encontrada' });

    const assets = await prisma.asset.count({ where: { categorySlug: slug } });
    if (assets) {
      return res.status(409).json({
        error: 'No se puede eliminar la categoría porque tiene activos vinculados.',
        blockers: [`${assets} activo(s) en esta categoría`],
        suggestion: 'Cambiá la categoría de esos activos o desactivala en vez de borrarla.',
      });
    }

    await prisma.assetCategory.delete({ where: { slug } });
    await audit({ req, action: 'DELETE', entityType: 'AssetCategory', entityId: slug, before });
    res.json({ ok: true, deleted: { slug, name: before.name } });
  } catch (err) { next(err); }
});

module.exports = router;
