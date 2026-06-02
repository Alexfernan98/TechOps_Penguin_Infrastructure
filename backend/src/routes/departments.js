const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

router.get('/', authenticate, async (_req, res, next) => {
  try {
    const depts = await prisma.department.findMany({ orderBy: [{ parentSlug: 'asc' }, { name: 'asc' }] });
    res.json({ departments: depts });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { slug, name, parentSlug, type = 'DEPARTMENT' } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'slug y name son requeridos' });

    const created = await prisma.department.create({
      data: { slug, name, parentSlug: parentSlug || null, type },
    });
    await audit({ req, action: 'CREATE', entityType: 'Department', entityId: created.slug, after: created });
    res.status(201).json({ department: created });
  } catch (err) { next(err); }
});

router.patch('/:slug', authenticate, requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { name, parentSlug, type, isActive } = req.body;
    const before = await prisma.department.findUnique({ where: { slug } });
    if (!before) return res.status(404).json({ error: 'Departamento no encontrado' });

    const after = await prisma.department.update({
      where: { slug },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(parentSlug !== undefined ? { parentSlug: parentSlug || null } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await audit({ req, action: 'UPDATE', entityType: 'Department', entityId: slug, before, after });
    res.json({ department: after });
  } catch (err) { next(err); }
});

module.exports = router;
