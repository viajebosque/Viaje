import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth/AuthContext';
import AuthPage from './pages/AuthPage';
import Forest from './pages/Forest';
import MissionPage from './pages/MissionPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminRoute from './auth/AdminRoute';
import LangToggle from './i18n/LangToggle';

export default function App() {
  const { session, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div className="auth-loading">{t('common.loading')}</div>;

  return (
    <>
      <div className="platform-lang-toggle">
        <LangToggle />
      </div>
      <Routes>
      {/* Raíz: si ya hay sesión, al bosque; si no, login/registro. */}
      <Route
        path="/"
        element={session ? <Navigate to="/forest" replace /> : <AuthPage />}
      />
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
          <ProtectedRoute>
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
