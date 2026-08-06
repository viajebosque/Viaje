import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

// Envuelve rutas privadas: si no hay sesión, manda al login.
export default function ProtectedRoute({
  children,
  allowLocalPreview = false,
}: {
  children: ReactNode;
  allowLocalPreview?: boolean;
}) {
  const { session, loading } = useAuth();
  const { t } = useTranslation();
  const isLocalPreview =
    allowLocalPreview &&
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === '1';

  if (loading) return <div className="auth-loading">{t('common.loading')}</div>;
  if (isLocalPreview) return <>{children}</>;
  if (!session) return <Navigate to="/" replace />;

  return <>{children}</>;
}
