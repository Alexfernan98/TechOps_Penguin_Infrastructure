import clsx from 'clsx';

const VARIANTS = {
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
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

export const ROLE_VARIANT = {
  SUPER_ADMIN: 'violet',
  IT_ADMIN:    'blue',
  IT_TECH:     'indigo',
  EMPLOYEE:    'slate',
  READ_ONLY:   'amber',
};

export const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  IT_ADMIN:    'IT Admin',
  IT_TECH:     'IT Técnico',
  EMPLOYEE:    'Empleado',
  READ_ONLY:   'Solo lectura',
};

export function RoleBadge({ role }) {
  return <Badge variant={ROLE_VARIANT[role] || 'slate'}>{ROLE_LABEL[role] || role}</Badge>;
}
