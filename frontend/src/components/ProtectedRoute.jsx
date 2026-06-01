import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

export default function ProtectedRoute({ children }) {
  const { user, loading, fetchUser } = useAuthStore();

  useEffect(() => {
    if (loading) fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
