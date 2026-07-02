const prisma = require('../../prisma/client');

// Próximo TAG correlativo para una categoría (ej. PE1H-NET-SW-001 → -002).
// Acepta un tx de Prisma para usarlo dentro de transacciones.
async function computeNextTag(category, tx = prisma) {
  const last = await tx.asset.findFirst({
    where: { categorySlug: category.slug, tag: { startsWith: category.tagPrefix } },
    orderBy: { tag: 'desc' },
    select: { tag: true },
  });
  let next = 1;
  if (last) {
    const m = last.tag.match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${category.tagPrefix}${String(next).padStart(3, '0')}`;
}

module.exports = { computeNextTag };
