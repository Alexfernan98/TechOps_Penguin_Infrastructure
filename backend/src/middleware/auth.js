const { verifyAccess } = require('../utils/jwt');
const prisma = require('../../prisma/client');

// Jerarquía de roles — mayor índice = más permisos
const ROLE_HIERARCHY = ['READ_ONLY', 'EMPLOYEE', 'IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN'];

async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.access_token
      ?? req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const payload = verifyAccess(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, name: true,
        nameFirst: true, nameLast: true, ci: true,
        avatarUrl: true, role: true,
        departmentSlug: true, isActive: true, generic: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuario no válido o desactivado' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userLevel    = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredLevel = Math.min(...roles.map(r => ROLE_HIERARCHY.indexOf(r)));

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'No tenés permisos para esta acción' });
    }

    return next();
  };
}

module.exports = { authenticate, requireRole };
