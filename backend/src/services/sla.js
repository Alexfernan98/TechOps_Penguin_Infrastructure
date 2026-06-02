// ─────────────────────────────────────────────────────────────────────────────
// SLA de tickets — reglas, cálculo de vencimientos y estado visual
// Espejo server-side de la lógica del prototipo (desarrollo.md §10.2)
// ─────────────────────────────────────────────────────────────────────────────

// Minutos: r = primera respuesta · R = resolución
const SLA_RULES = {
  CRITICAL: { r: 15,   R: 120 },
  HIGH:     { r: 60,   R: 240 },
  MEDIUM:   { r: 240,  R: 1440 },
  LOW:      { r: 1440, R: 7200 },
};

const MIN = 60 * 1000;

// Devuelve los vencimientos de respuesta y resolución a partir de la creación.
function computeDueDates(priority, createdAt = new Date()) {
  const rule = SLA_RULES[priority] || SLA_RULES.MEDIUM;
  const base = new Date(createdAt).getTime();
  return {
    responseDue: new Date(base + rule.r * MIN),
    resolveDue:  new Date(base + rule.R * MIN),
  };
}

// Estado visual del SLA. firstResponseAt puede ser null.
// Devuelve { color, label, breached }.
function slaStatus(ticket, firstResponseAt = null, now = new Date()) {
  const closed = ['CLOSED', 'RESOLVED', 'CANCELLED'].includes(ticket.status);
  if (closed) return { color: 'slate', label: 'Cerrado', breached: false };

  const { responseDue, resolveDue } = computeDueDates(ticket.priority, ticket.createdAt);
  const nowMs = now.getTime();

  if (!firstResponseAt && nowMs > responseDue.getTime()) {
    return { color: 'rose', label: 'Respuesta vencida', breached: true };
  }
  if (nowMs > resolveDue.getTime()) {
    return { color: 'rose', label: 'Resolución vencida', breached: true };
  }
  if (!firstResponseAt && (responseDue.getTime() - nowMs) < 30 * MIN) {
    return { color: 'amber', label: 'Respuesta en riesgo', breached: false };
  }
  if ((resolveDue.getTime() - nowMs) < 60 * MIN) {
    return { color: 'amber', label: 'Resolución en riesgo', breached: false };
  }
  return { color: 'emerald', label: 'En plazo', breached: false };
}

// Deriva firstResponseAt desde los comentarios: primer comentario público de
// un técnico (rol IT_TECH+). Recibe los comentarios con author.role incluido.
const TECH_ROLES = ['IT_TECH', 'IT_ADMIN', 'SUPER_ADMIN'];
function deriveFirstResponse(comments = []) {
  const techPublic = comments
    .filter(c => !c.isInternal && TECH_ROLES.includes(c.author?.role))
    .map(c => new Date(c.createdAt).getTime());
  if (!techPublic.length) return null;
  return new Date(Math.min(...techPublic));
}

module.exports = { SLA_RULES, computeDueDates, slaStatus, deriveFirstResponse, TECH_ROLES };
