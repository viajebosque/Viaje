import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { useRole } from './useRole';

// Envuelve las rutas de administración:
//   sin sesión        -> al login
//   sesión sin admin  -> al bosque
//   role = 'admin'    -> pasa
//
// Esto solo esconde la pantalla. Los datos igual los sirve el backend, que
// vuelve a verificar el rol en cada request.
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { role, checking } = useRole();
  const { t } = useTranslation();

  if (loading || checking)
    return <div className="auth-loading">{t('common.loading')}</div>;
  if (!session) return <Navigate to="/" replace />;
  if (role !== 'admin') return <Navigate to="/forest" replace />;

  return <>{children}</>;
}
