import clsx from 'clsx';

const VARIANTS = {
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  orange:  'bg-orange-50 text-orange-700 border-orange-200',
  teal:    'bg-teal-50 text-teal-700 border-teal-200',
  dark:    'bg-slate-800 text-white border-slate-800',
};

export default function Badge({ variant = 'slate', children, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium',
      VARIANTS[variant] || VARIANTS.slate,
      className,
    )}>
      {children}
    </span>
  );
}

// ── Roles ──────────────────────────────────────────────────────────────────────
export const ROLE_VARIANT = {
  SUPER_ADMIN: 'violet', IT_ADMIN: 'blue', IT_TECH: 'indigo', EMPLOYEE: 'slate', READ_ONLY: 'amber',
};
export const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin', IT_ADMIN: 'IT Admin', IT_TECH: 'IT Técnico', EMPLOYEE: 'Empleado', READ_ONLY: 'Solo lectura',
};
export function RoleBadge({ role }) {
  return <Badge variant={ROLE_VARIANT[role] || 'slate'}>{ROLE_LABEL[role] || role}</Badge>;
}

// ── Estado de activo (RF-INV) ──────────────────────────────────────────────────
export const ASSET_STATUS_VARIANT = {
  AVAILABLE: 'emerald', ASSIGNED: 'blue', LOAN: 'violet', REPAIR: 'amber', DAMAGED: 'rose', RETIRED: 'slate', LOST: 'dark', IN_PRODUCTION: 'teal',
};
export const ASSET_STATUS_LABEL = {
  AVAILABLE: 'Disponible', ASSIGNED: 'Asignado', LOAN: 'Préstamo', REPAIR: 'En reparación', DAMAGED: 'Dañado', RETIRED: 'Retirado', LOST: 'Perdido', IN_PRODUCTION: 'En producción',
};
export function AssetStatusBadge({ status }) {
  return <Badge variant={ASSET_STATUS_VARIANT[status] || 'slate'}>{ASSET_STATUS_LABEL[status] || status}</Badge>;
}

// ── Condición (texto coloreado, sin badge) ─────────────────────────────────────
export const CONDITION_LABEL = { GOOD: 'Bueno', FAIR: 'Aceptable', POOR: 'Malo', DAMAGED: 'Dañado' };
const CONDITION_COLOR = { GOOD: 'text-emerald-600', FAIR: 'text-amber-600', POOR: 'text-orange-700', DAMAGED: 'text-rose-600' };
export function ConditionText({ condition }) {
  return <span className={clsx('text-sm font-medium', CONDITION_COLOR[condition] || 'text-slate-600')}>{CONDITION_LABEL[condition] || condition || '—'}</span>;
}

// ── Prioridad de ticket (badge sólido) ─────────────────────────────────────────
const PRIORITY_SOLID = { CRITICAL: 'bg-rose-600 text-white', HIGH: 'bg-amber-500 text-white', MEDIUM: 'bg-blue-600 text-white', LOW: 'bg-slate-400 text-white' };
export const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
export const PRIORITY_BORDER = { CRITICAL: 'border-rose-500', HIGH: 'border-amber-500', MEDIUM: 'border-blue-500', LOW: 'border-slate-300' };
export function PriorityBadge({ priority }) {
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', PRIORITY_SOLID[priority] || PRIORITY_SOLID.LOW)}>{PRIORITY_LABEL[priority] || priority}</span>;
}

// ── Estado de ticket ────────────────────────────────────────────────────────────
export const TICKET_STATUS_VARIANT = {
  OPEN: 'blue', ASSIGNED: 'indigo', IN_PROGRESS: 'violet', PENDING_USER: 'amber', RESOLVED: 'emerald', CLOSED: 'slate', REOPENED: 'rose', CANCELLED: 'slate',
};
export const TICKET_STATUS_LABEL = {
  OPEN: 'Abierto', ASSIGNED: 'Asignado', IN_PROGRESS: 'En progreso', PENDING_USER: 'Pend. usuario', RESOLVED: 'Resuelto', CLOSED: 'Cerrado', REOPENED: 'Reabierto', CANCELLED: 'Cancelado',
};
export function TicketStatusBadge({ status }) {
  return <Badge variant={TICKET_STATUS_VARIANT[status] || 'slate'}>{TICKET_STATUS_LABEL[status] || status}</Badge>;
}

export const TICKET_CATEGORY_LABEL = {
  TECH_SUPPORT: 'Soporte técnico', EQUIPMENT_REQUEST: 'Solicitud de equipo', ACCESS_PERMISSIONS: 'Accesos y permisos',
  CONNECTIVITY: 'Conectividad', SOFTWARE: 'Software', SECURITY: 'Seguridad', OTHER: 'Otro',
};

// ── SLA (color provisto por el backend) ────────────────────────────────────────
export function SlaBadge({ sla }) {
  if (!sla) return null;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium', VARIANTS[sla.color] || VARIANTS.slate)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', {
        'bg-emerald-500': sla.color === 'emerald', 'bg-amber-500': sla.color === 'amber',
        'bg-rose-500': sla.color === 'rose', 'bg-slate-400': sla.color === 'slate',
      })} />
      {sla.label}
    </span>
  );
}

// ── Tipo de acta ─────────────────────────────────────────────────────────────────
export const ACTA_TYPE_VARIANT = { DELIVERY: 'emerald', RETURN: 'blue', RETIREMENT: 'rose' };
export const ACTA_TYPE_LABEL = { DELIVERY: 'Entrega', RETURN: 'Devolución', RETIREMENT: 'Baja' };
export function ActaTypeBadge({ type }) {
  return <Badge variant={ACTA_TYPE_VARIANT[type] || 'slate'}>{ACTA_TYPE_LABEL[type] || type}</Badge>;
}

// ── Acción de auditoría (RF-AUD §6.3) ──────────────────────────────────────────
export const AUDIT_VARIANT = {
  CREATE: 'emerald', UPDATE: 'blue', DELETE: 'rose', DELETE_LOGICAL: 'rose', STATUS_CHANGE: 'amber',
  ASSIGN: 'indigo', UNASSIGN: 'slate', LOGIN: 'slate', LOGOUT: 'slate',
};
export function AuditActionBadge({ action }) {
  return <Badge variant={AUDIT_VARIANT[action] || 'slate'}>{action}</Badge>;
}
