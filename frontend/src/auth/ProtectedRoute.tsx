import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

// Envuelve rutas privadas: si no hay sesión, manda al login.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="auth-loading">{t('common.loading')}</div>;
  if (!session) return <Navigate to="/" replace />;

  return <>{children}</>;
}
