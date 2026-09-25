import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import ScreenLoader from '../components/ScreenLoader';
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

  if (loading || checking)
    return <ScreenLoader />;
  if (!session) return <Navigate to="/" replace />;
  if (role !== 'admin') return <Navigate to="/forest" replace />;

  return <>{children}</>;
}
