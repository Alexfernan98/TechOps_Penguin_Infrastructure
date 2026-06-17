const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { notify, notifyRole } = require('../services/notify');
const { computeDueDates, slaStatus, deriveFirstResponse, TECH_ROLES } = require('../services/sla');

// ─────────────────────────────────────────────────────────────────────────────
// Tickets de Soporte (RF-TKT) — desarrollo.md §10
// ─────────────────────────────────────────────────────────────────────────────

const PERSON = { id: true, name: true, nameFirst: true, nameLast: true, email: true, avatarUrl: true, role: true };
const COMMENT_LIGHT = { select: { id: true, isInternal: true, createdAt: true, author: { select: { role: true } } } };

const TICKET_INCLUDE = {
  createdBy:  { select: PERSON },
  assignedTo: { select: PERSON },
  comments:   COMMENT_LIGHT,
};

const STATUSES   = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES = ['TECH_SUPPORT', 'EQUIPMENT_REQUEST', 'ACCESS_PERMISSIONS', 'CONNECTIVITY', 'SOFTWARE', 'SECURITY', 'OTHER'];

const isTech = (u) => TECH_ROLES.includes(u.role);

function withSla(ticket, { stripComments = false } = {}) {
  const fr = deriveFirstResponse(ticket.comments || []);
  const out = { ...ticket, firstResponseAt: fr, sla: slaStatus(ticket, fr) };
  if (stripComments) delete out.comments;
  return out;
}

async function nextTicketNumber(tx, year) {
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end   = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const count = await tx.ticket.count({ where: { createdAt: { gte: start, lt: end } } });
  return `TK-${year}-${String(count + 1).padStart(4, '0')}`;
}

// ── GET /tickets ───────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, priority, assigneeId, requesterId, search, slaBreached, dateFrom, dateTo } = req.query;
    const where = { deletedAt: null };
    if (status)     where.status = status;
    if (priority)   where.priority = priority;
    if (assigneeId) where.assignedToId = assigneeId;
    if (requesterId) where.createdById = requesterId;
    if (slaBreached === 'true') where.slaBreached = true;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { number: { contains: String(search), mode: 'insensitive' } },
        { title:  { contains: String(search), mode: 'insensitive' } },
      ];
    }
    // EMPLOYEE sólo ve los tickets que creó.
    if (req.user.role === 'EMPLOYEE') where.createdById = req.user.id;

    const tickets = await prisma.ticket.findMany({ where, include: TICKET_INCLUDE, orderBy: { createdAt: 'desc' } });
    res.json({ tickets: tickets.map(t => withSla(t, { stripComments: true })) });
  } catch (err) { next(err); }
});

// ── POST /tickets ────────────────────────────────────────────────────────────
// Valida que el usuario al que se asigna un ticket sea técnico.
// TECH_ROLES viene de services/sla.js.
async function assertAssigneeIsTech(tx, assignedToId) {
  if (!assignedToId) return;
  const u = await tx.user.findUnique({
    where: { id: assignedToId },
    select: { role: true, isActive: true, deletedAt: true },
  });
  if (!u || !u.isActive || u.deletedAt) {
    const err = new Error('Usuario asignado no existe o está inactivo'); err.status = 400; throw err;
  }
  if (!TECH_ROLES.includes(u.role)) {
    const err = new Error('Solo se puede asignar tickets a IT_TECH, IT_ADMIN o SUPER_ADMIN'); err.status = 400; throw err;
  }
}

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, description, priority = 'MEDIUM', category = 'TECH_SUPPORT', assetId, assignedToId } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'title y description son requeridos' });
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'priority inválida' });

    const now = new Date();
    const { resolveDue } = computeDueDates(priority, now);

    const created = await prisma.$transaction(async (tx) => {
      await assertAssigneeIsTech(tx, assignedToId);
      const number = await nextTicketNumber(tx, now.getFullYear());
      return tx.ticket.create({
        data: {
          number, title, description, priority,
          category: CATEGORIES.includes(category) ? category : 'TECH_SUPPORT',
          createdById: req.user.id,
          assignedToId: assignedToId || null,
          status: assignedToId ? 'ASSIGNED' : 'OPEN',
          assetId: assetId || null,
          dueAt: resolveDue,
        },
        include: TICKET_INCLUDE,
      });
    });

    await audit({ req, action: 'CREATE', entityType: 'Ticket', entityId: created.id, after: created });
    if (assignedToId) {
      await notify({ userId: assignedToId, type: 'SLA', title: 'Nuevo ticket asignado', body: `${created.number}: ${title}`, entityType: 'Ticket', entityId: created.id });
    } else {
      await notifyRole('IT_ADMIN', { type: 'TICKET_UPDATE', title: 'Nuevo ticket', body: `${created.number}: ${title}`, entityType: 'Ticket', entityId: created.id });
    }
    res.status(201).json({ ticket: withSla(created, { stripComments: true }) });
  } catch (err) { next(err); }
});

// ── GET /tickets/:id (con comentarios filtrados para EMPLOYEE) ─────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy:  { select: PERSON },
        assignedTo: { select: PERSON },
        csat: true,
        comments: { include: { author: { select: PERSON } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const employee = !isTech(req.user);
    if (employee && ticket.createdById !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    // Las notas internas son invisibles para el solicitante.
    let comments = ticket.comments;
    if (employee) comments = comments.filter(c => !c.isInternal);

    res.json({ ticket: withSla({ ...ticket, comments }), allComments: ticket.comments });
  } catch (err) { next(err); }
});

// ── PATCH /tickets/:id (metadata) ──────────────────────────────────────────────
router.patch('/:id', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const before = await prisma.ticket.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Ticket no encontrado' });

    const { title, description, priority, category, assetId } = req.body;
    const data = {};
    if (title       !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority    !== undefined && PRIORITIES.includes(priority)) {
      data.priority = priority;
      data.dueAt = computeDueDates(priority, before.createdAt).resolveDue; // recalcula SLA
    }
    if (category    !== undefined && CATEGORIES.includes(category)) data.category = category;
    if (assetId     !== undefined) data.assetId = assetId || null;

    const after = await prisma.ticket.update({ where: { id }, data, include: TICKET_INCLUDE });
    await audit({ req, action: 'UPDATE', entityType: 'Ticket', entityId: id, before, after });
    res.json({ ticket: withSla(after, { stripComments: true }) });
  } catch (err) { next(err); }
});

// ── PATCH /tickets/:id/status ──────────────────────────────────────────────────
router.patch('/:id/status', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status inválido' });

    const before = await prisma.ticket.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Ticket no encontrado' });

    const data = { status };
    if (status === 'RESOLVED' && !before.resolvedAt) data.resolvedAt = new Date();
    if (status === 'CLOSED')   data.closedAt = new Date();
    if (status === 'REOPENED') { data.resolvedAt = null; data.closedAt = null; }

    const after = await prisma.ticket.update({ where: { id }, data, include: TICKET_INCLUDE });
    await audit({ req, action: 'STATUS_CHANGE', entityType: 'Ticket', entityId: id, before, after });
    await notify({
      userId: before.createdById, type: 'TICKET_UPDATE',
      title: `Ticket ${before.number} actualizado`,
      body: `El estado de tu ticket cambió a ${status}.`,
      entityType: 'Ticket', entityId: id,
      email: { entityPath: '/tickets', ctaLabel: 'Ver ticket' },
    });
    res.json({ ticket: withSla(after, { stripComments: true }) });
  } catch (err) { next(err); }
});

// ── PATCH /tickets/:id/assign ──────────────────────────────────────────────────
router.patch('/:id/assign', authenticate, requireRole('IT_TECH'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;
    const before = await prisma.ticket.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Ticket no encontrado' });
    try { await assertAssigneeIsTech(prisma, assignedToId); }
    catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

    const data = { assignedToId: assignedToId || null };
    if (assignedToId && before.status === 'OPEN') data.status = 'ASSIGNED';

    const after = await prisma.ticket.update({ where: { id }, data, include: TICKET_INCLUDE });
    await audit({ req, action: 'UPDATE', entityType: 'Ticket', entityId: id, before, after });
    if (assignedToId) {
      await notify({ userId: assignedToId, type: 'SLA', title: 'Ticket asignado', body: `Se te asignó ${before.number}: ${before.title}`, entityType: 'Ticket', entityId: id });
    }
    res.json({ ticket: withSla(after, { stripComments: true }) });
  } catch (err) { next(err); }
});

// ── POST /tickets/:id/comments ─────────────────────────────────────────────────
router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body, isInternal } = req.body;
    if (!body) return res.status(400).json({ error: 'body es requerido' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const employee = !isTech(req.user);
    if (employee && ticket.createdById !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    // Sólo técnicos pueden marcar notas internas.
    const internal = !employee && isInternal === true;

    const comment = await prisma.ticketComment.create({
      data: { ticketId: id, authorId: req.user.id, body, isInternal: internal },
      include: { author: { select: PERSON } },
    });

    // Si es el primer comentario público de un técnico → notificar al solicitante (firstResponse).
    if (!internal && isTech(req.user) && ticket.createdById !== req.user.id) {
      await notify({
        userId: ticket.createdById, type: 'TICKET_UPDATE',
        title: `Respuesta en ${ticket.number}`,
        body: 'Un técnico respondió tu ticket.',
        entityType: 'Ticket', entityId: id,
        email: { entityPath: '/tickets', ctaLabel: 'Ver ticket' },
      });
    }
    res.status(201).json({ comment });
  } catch (err) { next(err); }
});

// ── POST /tickets/:id/csat (1-5, sólo el solicitante tras RESOLVED) ────────────
router.post('/:id/csat', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const score = parseInt(req.body.score, 10);
    if (!(score >= 1 && score <= 5)) return res.status(400).json({ error: 'score debe estar entre 1 y 5' });

    const ticket = await prisma.ticket.findUnique({ where: { id }, include: { csat: true } });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket.createdById !== req.user.id) return res.status(403).json({ error: 'Sólo el solicitante puede calificar' });
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) return res.status(400).json({ error: 'El ticket debe estar resuelto para calificar' });
    if (ticket.csat) return res.status(409).json({ error: 'El ticket ya fue calificado' });

    const csat = await prisma.csatResponse.create({ data: { ticketId: id, userId: req.user.id, score, comment: req.body.comment || null } });
    await prisma.ticket.update({ where: { id }, data: { csatScore: score } });
    await audit({ req, action: 'UPDATE', entityType: 'Ticket', entityId: id, after: { csatScore: score } });
    res.status(201).json({ csat });
  } catch (err) { next(err); }
});

module.exports = router;
