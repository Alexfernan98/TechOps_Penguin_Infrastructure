const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Auditoría — bitácora inmutable, sólo lectura (RF-AUD) — desarrollo.md §6
// Acceso: SUPER_ADMIN, IT_ADMIN, READ_ONLY.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'IT_ADMIN', 'READ_ONLY'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { entityType, entityId, actorId, action, from, to } = req.query;
    const page    = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage || '50', 10)));

    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId)   where.entityId = entityId;
    if (actorId)    where.userId = actorId;
    if (action)     where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
        include: { user: { select: { id: true, name: true, nameFirst: true, nameLast: true, email: true } } },
      }),
    ]);

    res.json({ logs, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } });
  } catch (err) { next(err); }
});

module.exports = router;
