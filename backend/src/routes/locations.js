const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

router.get('/', authenticate, async (_req, res, next) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
    });
    res.json({
      locations: locations.map(l => ({
        slug: l.slug, name: l.name, siteCode: l.siteCode, isActive: l.isActive,
        assetCount: l._count.assets,
      })),
    });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { slug, name, siteCode = 'PE1H' } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'slug y name son requeridos' });
    const created = await prisma.location.create({ data: { slug, name, siteCode } });
    await audit({ req, action: 'CREATE', entityType: 'Location', entityId: created.slug, after: created });
    res.status(201).json({ location: created });
  } catch (err) { next(err); }
});

router.patch('/:slug', authenticate, requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const before = await prisma.location.findUnique({ where: { slug } });
    if (!before) return res.status(404).json({ error: 'Ubicación no encontrada' });
    const { name, siteCode, isActive } = req.body;
    const after = await prisma.location.update({
      where: { slug },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(siteCode !== undefined ? { siteCode } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await audit({ req, action: 'UPDATE', entityType: 'Location', entityId: slug, before, after });
    res.json({ location: after });
  } catch (err) { next(err); }
});

module.exports = router;
