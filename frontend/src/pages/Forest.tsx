import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  getMissions,
  getCompletedMissionIds,
  type Mission,
} from '../lib/missions';

export default function Forest() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ numero: number; titulo: string } | null>(
    null
  );

  useEffect(() => {
    getMissions().then(setMissions).catch(() => setMissions([]));
    getCompletedMissionIds().then(setCompleted).catch(() => {});
  }, []);

  // mapa numero -> misión (para saber título / si existe contenido)
  const byNumero = new Map(missions.map((m) => [m.numero, m]));

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <main className="forest">
      <header className="forest-top">
        <span>{user?.email}</span>
        <button onClick={handleSignOut}>Cerrar sesión</button>
      </header>

      <h1 className="forest-title">El Mapa del Bosque 🌲</h1>
      <p className="forest-sub">Elige una misión para comenzar.</p>

      <div className="mission-grid">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
          const m = byNumero.get(n);
          const isDone = m ? completed.has(m.id) : false;
          return (
            <button
              key={n}
              className={`mission-node ${isDone ? 'done' : ''}`}
              onClick={() => setSelected({ numero: n, titulo: m?.titulo ?? '' })}
            >
              <span className="mission-node-num">{n}</span>
              <span className="mission-node-title">
                {m?.titulo ?? 'Próximamente'}
              </span>
              {isDone && <span className="mission-node-token">🪙</span>}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Misión {selected.numero}</h2>
            {selected.titulo && <p className="modal-mission-title">{selected.titulo}</p>}
            <p>¿Quieres ingresar a esta misión?</p>
            <div className="modal-actions">
              <button
                className="modal-primary"
                onClick={() => navigate(`/mission/${selected.numero}`)}
              >
                Ingresar
              </button>
              <button className="modal-ghost" onClick={() => setSelected(null)}>
                Volver al mapa
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
