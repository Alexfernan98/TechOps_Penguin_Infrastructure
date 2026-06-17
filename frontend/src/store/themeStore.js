import { create } from 'zustand';

// Tema con persistencia en localStorage. Aplica/quita la clase `dark` en <html>
// (Tailwind `darkMode: 'class'`) y respeta la preferencia del sistema en el
// primer render si el usuario nunca cambió manualmente.
const STORAGE_KEY = 'techops-theme';

function readInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* noop */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function apply(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

const initial = typeof window !== 'undefined' ? readInitial() : 'light';
if (typeof window !== 'undefined') apply(initial);

const useThemeStore = create((set, get) => ({
  theme: initial,
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
    set({ theme: next });
  },
  setTheme: (theme) => {
    if (theme !== 'dark' && theme !== 'light') return;
    apply(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* noop */ }
    set({ theme });
  },
}));

export default useThemeStore;
