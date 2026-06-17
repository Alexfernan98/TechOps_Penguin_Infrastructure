const prisma = require('../../prisma/client');
const { slaStatus, deriveFirstResponse } = require('./sla');
const { notify, notifyRole } = require('./notify');

// ─────────────────────────────────────────────────────────────────────────────
// Jobs en background (RF-TKT-§10.7 + RF-NOT) — sin dependencias externas, usa setInterval.
// ─────────────────────────────────────────────────────────────────────────────

const OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'REOPENED'];

// Barrido de SLA cada 5 minutos: marca breaches y notifica a técnico + IT_ADMIN.
async function sweepSla() {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { deletedAt: null, status: { in: OPEN_STATUSES } },
      include: { comments: { select: { isInternal: true, createdAt: true, author: { select: { role: true } } } } },
    });
    for (const t of tickets) {
      const fr = deriveFirstResponse(t.comments);
      const sla = slaStatus(t, fr);
      if (sla.breached && !t.slaBreached) {
        await prisma.ticket.update({ where: { id: t.id }, data: { slaBreached: true } });
        if (t.assignedToId) {
          await notify({ userId: t.assignedToId, type: 'SLA', title: `SLA vencido · ${t.number}`, body: `${sla.label}: ${t.title}`, entityType: 'Ticket', entityId: t.id, email: { entityPath: '/tickets' } });
        }
        await notifyRole('IT_ADMIN', { type: 'SLA', title: `SLA vencido · ${t.number}`, body: `${sla.label}: ${t.title}`, entityType: 'Ticket', entityId: t.id });
      }
    }
  } catch (err) { console.error('sweepSla falló:', err.message); }
}

// Alerta diaria de garantías por vencer (< 90 días) a IT_ADMIN.
async function sweepWarranties() {
  try {
    const limit = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const count = await prisma.asset.count({ where: { deletedAt: null, warrantyUntil: { not: null, lte: limit } } });
    if (count > 0) {
      await notifyRole('IT_ADMIN', { type: 'WARRANTY', title: 'Garantías por vencer', body: `${count} activos tienen garantía que vence en menos de 90 días.`, entityType: 'Asset' });
    }
  } catch (err) { console.error('sweepWarranties falló:', err.message); }
}

// Wrapper que captura cualquier rechazo no manejado dentro del sweep para que
// un crash de un job no tumbe los próximos ni el process.
function safe(fn, name) {
  return () => {
    Promise.resolve()
      .then(fn)
      .catch(err => console.error(`[cron:${name}] crash:`, err && err.message || err));
  };
}

function startCron() {
  if (process.env.DISABLE_CRON === 'true') return;
  setInterval(safe(sweepSla, 'sweepSla'), 5 * 60 * 1000);
  setInterval(safe(sweepWarranties, 'sweepWarranties'), 24 * 60 * 60 * 1000);
  console.log('⏱️  Cron de SLA (5 min) y garantías (24 h) iniciado');
}

module.exports = { startCron, sweepSla, sweepWarranties };
