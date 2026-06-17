const prisma = require('../../prisma/client');
const { sendEmail } = require('./email');

// ─────────────────────────────────────────────────────────────────────────────
// Notificaciones in-app (RF-NOT) + email opcional.
// type ∈ WARRANTY · SLA · TICKET_UPDATE · ASSIGNMENT · ACTA · SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Construye el appUrl a partir de un Express `req` (si está disponible) o cae al .env.
// Pasalo desde los handlers como `appUrl: appUrlFromReq(req)` para que los links de
// email funcionen desde cualquier host LAN (nip.io, IP, localhost, etc).
function appUrlFromReq(req) {
  if (!req) return null;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return host ? `${proto}://${host}` : null;
}

async function notify({ userId, title, body, type = 'SYSTEM', entityType, entityId, email, appUrl }) {
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
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, notifPrefs: true },
      });
      // Respeta opt-out por tipo (si el user lo desactivó en preferencias).
      const optedOut = user?.notifPrefs && user.notifPrefs[type] === false;
      if (user?.email && !optedOut) {
        await sendEmail({
          to: user.email,
          subject: title,
          title,
          message: body,
          ctaLabel: email.ctaLabel,
          entityPath: email.entityPath,
          ctaUrl: email.ctaUrl,
          appUrl,
        });
      }
    } catch (err) {
      console.error('Email de notificación falló:', err.message);
    }
  }
  return created;
}

// Notifica a todos los usuarios activos de un rol dado (ej: IT_ADMIN).
// Usa allSettled para que el fallo de un email/notif individual no tumbe los demás.
async function notifyRole(role, payload) {
  try {
    const users = await prisma.user.findMany({
      where: { role, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const results = await Promise.allSettled(users.map(u => notify({ ...payload, userId: u.id })));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) console.error(`notifyRole(${role}): ${failed.length}/${users.length} fallidas`);
  } catch (err) {
    console.error(`notifyRole(${role}) falló:`, err.message);
  }
}

module.exports = { notify, notifyRole, appUrlFromReq };
