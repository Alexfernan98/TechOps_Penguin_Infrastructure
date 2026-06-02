const prisma = require('../../prisma/client');

async function audit({ req, action, entityType, entityId, before, after }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:     req?.user?.id ?? null,
        action,
        entityType,
        entityId,
        before:     before ?? undefined,
        after:      after  ?? undefined,
        ipAddress:  req?.ip ?? null,
        userAgent:  req?.headers?.['user-agent'] ?? null,
      },
    });
  } catch (err) {
    console.error('AuditLog falló:', err);
  }
}

module.exports = { audit };
