import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

// Usa el mismo origen del browser por defecto (nginx enruta /auth al backend).
// Así funciona desde cualquier IP de la LAN sin reconfigurar.
const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export default function LoginPage() {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  // Forzamos colores con inline styles porque el dark mode global de la app
  // (definido en index.css) overridea los utility classes de Tailwind en esta página.
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 shadow-lg p-2" style={{ backgroundColor: '#ffffff' }}>
            <img src="/logo-penguin.png" alt="Penguin Infrastructure" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>NetHub</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Penguin Infrastructure S.A.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <h2 className="text-xl font-semibold mb-1" style={{ color: '#1e293b' }}>Iniciar sesión</h2>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>
            Acceso exclusivo para cuentas <span className="font-medium" style={{ color: '#334155' }}>@penguin.digital</span>
          </p>

          {authError === 'unauthorized' && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              La cuenta no pertenece al dominio <span className="font-medium">@penguin.digital</span>.
              Iniciá sesión con tu cuenta corporativa.
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-150 shadow-sm hover:shadow"
            style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#334155' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>

          <p className="text-center text-xs mt-6" style={{ color: '#94a3b8' }}>
            Solo cuentas corporativas @penguin.digital tienen acceso.
          </p>
        </div>

      </div>
    </div>
  );
}
