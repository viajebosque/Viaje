import { Routes, Route, Navigate, useMatch } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import Forest from './pages/Forest';
import MissionPage from './pages/MissionPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminRoute from './auth/AdminRoute';
import LangToggle from './i18n/LangToggle';
import TokenPreview from './pages/TokenPreview';
import ScreenLoader from './components/ScreenLoader';

export default function App() {
  const { session, loading } = useAuth();
  const missionRoute = useMatch('/mission/:numero');
  const rootRoute = useMatch('/');
  const resetRoute = useMatch('/reset-password');

  // Las pantallas públicas cargan con el fondo del login, el resto con el mapa.
  if (loading) return (
    <ScreenLoader
      numero={missionRoute ? Number(missionRoute.params.numero) : undefined}
      background={rootRoute || resetRoute ? 'login' : 'forest'}
    />
  );

  return (
    <>
      <div className="platform-lang-toggle">
        <LangToggle />
      </div>
      <Routes>
      <Route path="/preview/token" element={<TokenPreview />} />
      <Route path="/preview/loading" element={<ScreenLoader numero={1} />} />
      {/* Raíz: si ya hay sesión, al bosque; si no, login/registro. */}
      <Route
        path="/"
        element={session ? <Navigate to="/forest" replace /> : <AuthPage />}
      />
      {/* Enlace del correo de recuperación. Pública a propósito: la sesión la
          crea el propio enlace, y si venció hay que poder ver el aviso. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/forest"
        element={
          <ProtectedRoute allowLocalPreview>
            <Forest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mission/:numero"
        element={
          <ProtectedRoute allowLocalPreview>
            <MissionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      {/* Panel de admin: exige role='admin'; si no, al bosque. */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
