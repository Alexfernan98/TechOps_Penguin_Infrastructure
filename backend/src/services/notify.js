const prisma = require('../../prisma/client');
const { sendEmail } = require('./email');

// ─────────────────────────────────────────────────────────────────────────────
// Notificaciones in-app (RF-NOT) + email opcional.
// type ∈ WARRANTY · SLA · TICKET_UPDATE · ASSIGNMENT · ACTA · SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

async function notify({ userId, title, body, type = 'SYSTEM', entityType, entityId, email }) {
  if (!userId) return null;
  let created = null;
  try {
    created = await prisma.notification.create({
      data: { userId, title, body, type, entityType: entityType || null, entityId: entityId || null },
    });
  } catch (err) {
    console.error('Notification falló:', err.message);
  }

  if (email) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: title,
          title,
          message: body,
          ctaLabel: email.ctaLabel,
          entityPath: email.entityPath,
          ctaUrl: email.ctaUrl,
        });
      }
    } catch (err) {
      console.error('Email de notificación falló:', err.message);
    }
  }
  return created;
}

// Notifica a todos los usuarios activos de un rol dado (ej: IT_ADMIN).
async function notifyRole(role, payload) {
  const users = await prisma.user.findMany({
    where: { role, isActive: true, deletedAt: null },
    select: { id: true },
  });
  await Promise.all(users.map(u => notify({ ...payload, userId: u.id })));
}

module.exports = { notify, notifyRole };
