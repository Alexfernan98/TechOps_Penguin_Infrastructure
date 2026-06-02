const router  = require('express').Router();
const prisma  = require('../../prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'penguin.digital';
const DOMAIN_RE = new RegExp(`@${ALLOWED_DOMAIN.replace(/\./g, '\\.')}$`, 'i');

const USER_SELECT = {
  id: true, email: true, name: true, nameFirst: true, nameLast: true,
  ci: true, avatarUrl: true, role: true, departmentSlug: true,
  isActive: true, generic: true, googleId: true,
  lastLoginAt: true, createdAt: true, updatedAt: true,
};

// ── GET /users ────────────────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { role, dept, active, search, includeInactive } = req.query;

    const where = { deletedAt: null };
    if (role)   where.role = role;
    if (dept)   where.departmentSlug = dept;
    if (active === 'true')  where.isActive = true;
    if (active === 'false') where.isActive = false;
    if (includeInactive !== 'true' && active === undefined) {
      // por default mostramos todos (activos + inactivos), sólo filtra deletedAt
    }
    if (search) {
      const s = String(search);
      where.OR = [
        { name:  { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { ci:    { contains: s, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    res.json({ users });
  } catch (err) { next(err); }
});

// ── GET /users/:id ────────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.id === id;
    const isAdmin = ['IT_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'No autorizado' });

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        assignedAssets: {
          where: { returnedAt: null },
          select: { id: true, asset: { select: { id: true, tag: true, brand: true, model: true, status: true } } },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user });
  } catch (err) { next(err); }
});

// ── PATCH /users/:id (rol / dept / ci / nombres) ──────────────────────────────
router.patch('/:id', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, departmentSlug, ci, nameFirst, nameLast, name } = req.body;

    if (role && role !== req.body.role) {
      // sólo SUPER_ADMIN puede asignar SUPER_ADMIN o cambiar roles a IT_ADMIN+
      const targetIsAdmin = ['IT_ADMIN', 'SUPER_ADMIN'].includes(role);
      if (targetIsAdmin && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Solo SUPER_ADMIN puede asignar este rol' });
      }
    }

    const before = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!before) return res.status(404).json({ error: 'Usuario no encontrado' });

    const data = {};
    if (role            !== undefined) data.role = role;
    if (departmentSlug  !== undefined) data.departmentSlug = departmentSlug || null;
    if (ci              !== undefined) data.ci = ci || null;
    if (nameFirst       !== undefined) data.nameFirst = nameFirst;
    if (nameLast        !== undefined) data.nameLast  = nameLast;
    if (name            !== undefined) data.name = name;

    const after = await prisma.user.update({ where: { id }, data, select: USER_SELECT });

    await audit({ req, action: 'UPDATE', entityType: 'User', entityId: id, before, after });
    res.json({ user: after });
  } catch (err) { next(err); }
});

// ── PATCH /users/:id/deactivate ───────────────────────────────────────────────
router.patch('/:id/deactivate', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });

    const before = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!before) return res.status(404).json({ error: 'Usuario no encontrado' });

    const after = await prisma.user.update({
      where: { id },
      data:  { isActive: false },
      select: USER_SELECT,
    });

    await audit({ req, action: 'DELETE_LOGICAL', entityType: 'User', entityId: id, before, after });
    res.json({ user: after });
  } catch (err) { next(err); }
});

// ── PATCH /users/:id/activate ─────────────────────────────────────────────────
router.patch('/:id/activate', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const before = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!before) return res.status(404).json({ error: 'Usuario no encontrado' });

    const after = await prisma.user.update({
      where: { id },
      data:  { isActive: true },
      select: USER_SELECT,
    });

    await audit({ req, action: 'UPDATE', entityType: 'User', entityId: id, before, after });
    res.json({ user: after });
  } catch (err) { next(err); }
});

// ── POST /users/invite (pre-registro) ─────────────────────────────────────────
router.post('/invite', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { email, role = 'EMPLOYEE', departmentSlug, ci, name, nameFirst, nameLast } = req.body;

    if (!email || !DOMAIN_RE.test(email)) {
      return res.status(400).json({ error: `Email debe pertenecer al dominio @${ALLOWED_DOMAIN}` });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

    const created = await prisma.user.create({
      data: {
        email,
        name:           name      ?? email.split('@')[0],
        nameFirst:      nameFirst ?? null,
        nameLast:       nameLast  ?? null,
        role,
        departmentSlug: departmentSlug || null,
        ci:             ci || null,
        googleId:       null,
        lastLoginAt:    null,
      },
      select: USER_SELECT,
    });

    await audit({ req, action: 'CREATE', entityType: 'User', entityId: created.id, after: created });
    res.status(201).json({ user: created });
  } catch (err) { next(err); }
});

// ── POST /users/import (CSV masivo de control de acceso HikVision/Hanwha) ─────
router.post('/import', authenticate, requireRole('IT_ADMIN'), async (req, res, next) => {
  try {
    const { rows } = req.body; // [{ id, nombre, apellido, departamento, email, ... }, ...]
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Body debe incluir rows: array' });
    }

    const result = { created: 0, updated: 0, skipped: 0, errors: [] };

    // Mapeo de paths del organigrama → slug interno
    const DEPT_MAP = {
      'minning operations':              'MINING_OPS',
      'microelectronics':                'MINING_OPS_MICROELECTRONICS',
      'cybersecurity & networking':      'MINING_OPS_NETWORKING_CS',
      'developers':                      'MINING_OPS_DEVELOPERS',
      'automation':                      'MINING_OPS_AUTOMATION',
      'facility':                        'FACILITY',
      'msu':                             'FACILITY_MSU',
      'maintenance':                     'MAINTENANCE',
      'people & culture':                'PEOPLE_CULTURE',
      'security and health':             'PEOPLE_CULTURE_SAFETY',
      'warehouse':                       'WAREHOUSE',
      'projects':                        'PROJECTS',
      'directory':                       'DIRECTORY',
    };
    const slugFromPath = (path = '') => {
      const parts = String(path).split('/').map(s => s.trim().toLowerCase()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        if (DEPT_MAP[parts[i]]) return DEPT_MAP[parts[i]];
      }
      return null;
    };

    for (const [idx, row] of rows.entries()) {
      try {
        const email = String(row.email ?? row['Correo electrónico'] ?? '').trim().toLowerCase();
        if (!email || !DOMAIN_RE.test(email)) { result.skipped++; continue; }

        const nameFirst = String(row.nombre ?? row['Nombre'] ?? '').trim();
        const nameLast  = String(row.apellido ?? row['Apellido'] ?? '').trim();
        const ci        = String(row.ci ?? row.id ?? row['ID'] ?? '').trim() || null;
        const dept      = slugFromPath(row.departamento ?? row['Departamento'] ?? '');
        const fullName  = `${nameFirst} ${nameLast}`.trim() || email.split('@')[0];

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          await prisma.user.update({
            where: { email },
            data: {
              name:      existing.name      || fullName,
              nameFirst: existing.nameFirst || nameFirst || null,
              nameLast:  existing.nameLast  || nameLast  || null,
              ci:        existing.ci        || ci,
              departmentSlug: existing.departmentSlug || dept,
            },
          });
          result.updated++;
        } else {
          await prisma.user.create({
            data: {
              email,
              name: fullName,
              nameFirst: nameFirst || null,
              nameLast:  nameLast  || null,
              ci,
              departmentSlug: dept,
              role: 'EMPLOYEE',
              googleId: null,
            },
          });
          result.created++;
        }
      } catch (e) {
        result.errors.push({ row: idx, error: e.message });
      }
    }

    await audit({ req, action: 'CREATE', entityType: 'User', entityId: 'bulk-import', after: result });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
