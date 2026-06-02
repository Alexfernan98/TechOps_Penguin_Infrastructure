export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export function shortName(u) {
  if (!u) return '—';
  if (u.nameFirst && u.nameLast) {
    return `${u.nameFirst.split(' ')[0]} ${u.nameLast.split(' ')[0]}`;
  }
  return u.name || u.email || '—';
}

export default function Avatar({ user, size = 32 }) {
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(user?.name)}
    </div>
  );
}
