import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import ScreenLoader from '../components/ScreenLoader';

// Envuelve rutas privadas: si no hay sesión, manda al login.
export default function ProtectedRoute({
  children,
  allowLocalPreview = false,
}: {
  children: ReactNode;
  allowLocalPreview?: boolean;
}) {
  const { session, loading } = useAuth();
  const isLocalPreview =
    allowLocalPreview &&
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === '1';

  if (loading) return <ScreenLoader />;
  if (isLocalPreview) return <>{children}</>;
  if (!session) return <Navigate to="/" replace />;

  return <>{children}</>;
}
