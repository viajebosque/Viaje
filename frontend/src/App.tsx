import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import AuthPage from './pages/AuthPage';
import Forest from './pages/Forest';
import MissionPage from './pages/MissionPage';
import ProtectedRoute from './auth/ProtectedRoute';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <div className="auth-loading">Cargando…</div>;

  return (
    <Routes>
      {/* Raíz: si ya hay sesión, al bosque; si no, login/registro. */}
      <Route
        path="/"
        element={session ? <Navigate to="/forest" replace /> : <AuthPage />}
      />
      <Route
        path="/forest"
        element={
          <ProtectedRoute>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
