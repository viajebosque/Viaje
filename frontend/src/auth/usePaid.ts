import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getProfileIsPaid } from '../lib/profile';

// ¿El usuario pagó? Sale de la misma fila de profiles que ya cachea lib/profile,
// así que no agrega una consulta: LangToggle y useRole la piden igual.
//
// `checking` es true mientras se lee. Importa: sin eso, quien sí pagó vería un
// parpadeo de candados en el mapa antes de que llegue la respuesta.
//
// OJO: esto es solo para la interfaz. El muro de pago de verdad lo aplica la
// base (SQL/012): la RLS de questions y complete_mission.
export function usePaid(): { isPaid: boolean; checking: boolean } {
  const { user, loading } = useAuth();
  const [isPaid, setIsPaid] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsPaid(false);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    getProfileIsPaid(user.id)
      .then((paid) => {
        if (!cancelled) setIsPaid(paid);
      })
      .catch(() => {
        if (!cancelled) setIsPaid(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isPaid, checking };
}
