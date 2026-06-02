const router = require('express').Router();
const prisma = require('../../prisma/client');
const { authenticate } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard y Analytics (RF-DSH) — desarrollo.md §11b
// Agregados server-side; el frontend los grafica con recharts.
// ─────────────────────────────────────────────────────────────────────────────

const OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'REOPENED'];

router.get('/', authenticate, async (_req, res, next) => {
  try {
    const warrantyLimit = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      statusGroups, totalActive, warrantySoon, retiredHistorical,
      ticketsOpen, ticketsCritical, actasPending, deptGroups, priorityGroups,
      resolvedTickets, recentTickets, departments,
    ] = await Promise.all([
      prisma.asset.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      prisma.asset.count({ where: { deletedAt: null } }),
      prisma.asset.count({ where: { deletedAt: null, warrantyUntil: { not: null, lte: warrantyLimit } } }),
      prisma.asset.count({ where: { status: { in: ['RETIRED', 'LOST'] } } }),
      prisma.ticket.count({ where: { deletedAt: null, status: { in: OPEN_STATUSES } } }),
      prisma.ticket.count({ where: { deletedAt: null, status: { in: OPEN_STATUSES }, priority: 'CRITICAL' } }),
      prisma.acta.count(),
      prisma.asset.groupBy({ by: ['departmentSlug'], where: { deletedAt: null, departmentSlug: { not: null } }, _count: true }),
      prisma.ticket.groupBy({ by: ['priority'], where: { deletedAt: null, status: { in: OPEN_STATUSES } }, _count: true }),
      prisma.ticket.findMany({ where: { status: { in: ['RESOLVED', 'CLOSED'] }, resolvedAt: { not: null } }, select: { resolvedAt: true, dueAt: true } }),
      prisma.ticket.findMany({ where: { deletedAt: null, createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.department.findMany({ select: { slug: true, name: true } }),
    ]);

    // Actas pendientes de firma (status vive en metadata) → contar las no firmadas.
    const allActas = await prisma.acta.findMany({ select: { metadata: true } });
    const actasPendingSign = allActas.filter(a => (a.metadata?.status || 'pending_sign') !== 'signed').length;

    const byStatus = Object.fromEntries(statusGroups.map(g => [g.status, g._count]));
    const repair = (byStatus.REPAIR || 0) + (byStatus.DAMAGED || 0);

    // SLA cumplido: resueltos dentro del vencimiento / total resueltos.
    const onTime = resolvedTickets.filter(t => t.dueAt && t.resolvedAt && new Date(t.resolvedAt) <= new Date(t.dueAt)).length;
    const slaCompliance = resolvedTickets.length ? Math.round((onTime / resolvedTickets.length) * 100) : 100;

    const deptName = Object.fromEntries(departments.map(d => [d.slug, d.name]));
    const assetsByDepartment = deptGroups
      .map(g => ({ slug: g.departmentSlug, name: deptName[g.departmentSlug] || g.departmentSlug, count: g._count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);

    const ticketsByPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => ({
      priority: p, count: priorityGroups.find(g => g.priority === p)?._count || 0,
    }));

    // Volumen de tickets por mes (últimos 6 meses).
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('es-PY', { month: 'short' }), count: 0 });
    }
    const monthIdx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    for (const t of recentTickets) {
      const d = new Date(t.createdAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthIdx[k] !== undefined) months[monthIdx[k]].count++;
    }

    res.json({
      kpis: {
        totalAssets: totalActive,
        assigned: byStatus.ASSIGNED || 0,
        available: byStatus.AVAILABLE || 0,
        repair,
        warrantySoon,
        retiredHistorical,
        ticketsOpen, ticketsCritical,
        actasPending: actasPendingSign,
      },
      assetsByStatus: ['AVAILABLE', 'ASSIGNED', 'LOAN', 'REPAIR', 'DAMAGED', 'RETIRED', 'LOST']
        .map(s => ({ status: s, count: byStatus[s] || 0 })).filter(x => x.count > 0),
      ticketsByPriority,
      slaCompliance,
      assetsByDepartment,
      ticketsByMonth: months,
    });
  } catch (err) { next(err); }
});

module.exports = router;
