import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Envuelve rutas privadas: si no hay sesión, manda al login.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <div className="auth-loading">Cargando…</div>;
  if (!session) return <Navigate to="/" replace />;

  return <>{children}</>;
}
