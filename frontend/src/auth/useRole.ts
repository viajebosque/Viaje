import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getProfileRole, type Role } from '../lib/profile';

// Rol del usuario logueado, para decidir qué mostrar en la interfaz.
// `checking` es true mientras se lee: sin eso, un admin ve un parpadeo de
// "no autorizado" antes de que llegue la respuesta.
//
// OJO: esto es solo para la UI. El permiso de verdad lo valida el backend en
// cada request (backend/src/middleware/requireAdmin.js).
export function useRole(): { role: Role | null; checking: boolean } {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRole(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    getProfileRole(user.id)
      .then((r) => {
        if (!cancelled) setRole(r);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { role, checking };
}
