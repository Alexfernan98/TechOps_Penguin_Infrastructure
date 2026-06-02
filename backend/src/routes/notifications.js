const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Notificaciones in-app (RF-NOT) — desarrollo.md §11.6
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /notifications (del usuario actual) ────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
    ]);
    res.json({ notifications, unread });
  } catch (err) { next(err); }
});

// ── POST /notifications/:id/read ───────────────────────────────────────────────
router.post('/:id/read', authenticate, async (req, res, next) => {
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n || n.userId !== req.user.id) return res.status(404).json({ error: 'Notificación no encontrada' });
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
    res.json({ notification: updated });
  } catch (err) { next(err); }
});

// ── POST /notifications/read-all ───────────────────────────────────────────────
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Preferencias de email (stub — opt-out por tipo) ────────────────────────────
router.get('/preferences', authenticate, (_req, res) => {
  res.json({ preferences: { WARRANTY: true, SLA: true, TICKET_UPDATE: true, ASSIGNMENT: true, ACTA: true } });
});
router.patch('/preferences', authenticate, (req, res) => {
  res.json({ preferences: req.body });
});

module.exports = router;
