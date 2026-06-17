const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Notificaciones in-app (RF-NOT) — desarrollo.md §11.6
// ─────────────────────────────────────────────────────────────────────────────

// Tipos de notificación con preferencia de email (todos default-on).
const DEFAULT_PREFS = {
  WARRANTY:      true,
  SLA:           true,
  TICKET_UPDATE: true,
  ASSIGNMENT:    true,
  ACTA:          true,
  SYSTEM:        true,
};

function sanitizePrefs(input) {
  const out = { ...DEFAULT_PREFS };
  if (!input || typeof input !== 'object') return out;
  for (const k of Object.keys(DEFAULT_PREFS)) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  return out;
}

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

// ── Marcar leída · PATCH (REST) + POST (alias compat con frontend viejo) ──────
async function markRead(req, res, next) {
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n || n.userId !== req.user.id) return res.status(404).json({ error: 'Notificación no encontrada' });
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
    res.json({ notification: updated });
  } catch (err) { next(err); }
}
router.patch('/:id/read', authenticate, markRead);
router.post('/:id/read',  authenticate, markRead);

// ── Marcar todas leídas · PATCH (REST) + POST (alias) ─────────────────────────
async function readAll(req, res, next) {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
router.patch('/read-all', authenticate, readAll);
router.post('/read-all',  authenticate, readAll);

// ── Preferencias persistentes en User.notifPrefs ───────────────────────────────
router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { notifPrefs: true } });
    res.json({ preferences: sanitizePrefs(u?.notifPrefs) });
  } catch (err) { next(err); }
});

router.patch('/preferences', authenticate, async (req, res, next) => {
  try {
    const prefs = sanitizePrefs(req.body);
    await prisma.user.update({ where: { id: req.user.id }, data: { notifPrefs: prefs } });
    res.json({ preferences: prefs });
  } catch (err) { next(err); }
});

module.exports = router;
