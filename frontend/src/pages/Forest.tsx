import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/useRole';
import { useLanguage } from '../i18n/useLanguage';
import forestMap from '../assets/forest/forest-map.png';
import {
  getMissions,
  getCompletedMissionIds,
  type Mission,
} from '../lib/missions';

const missionPositions = [
  { left: 5.9, top: 55.2 },
  { left: 20.7, top: 48.2 },
  { left: 30.4, top: 65.1 },
  { left: 41.8, top: 50.6 },
  { left: 53, top: 68 },
  { left: 64.2, top: 80 },
  { left: 74.3, top: 62.3 },
  { left: 85, top: 56.1 },
  { left: 93.9, top: 64.3 },
] as const;

export default function Forest() {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ numero: number; titulo: string } | null>(
    null
  );

  // Re-lee las misiones al cambiar el idioma: los títulos vienen de la BD.
  useEffect(() => {
    getMissions(lang)
      .then(setMissions)
      .catch(() => setMissions([]));
  }, [lang]);

  useEffect(() => {
    getCompletedMissionIds()
      .then(setCompleted)
      .catch(() => {});
  }, []);

  // Mapa número -> misión (para saber título / si existe contenido).
  const byNumero = new Map(missions.map((m) => [m.numero, m]));

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <main className="forest">
      <header className="forest-top">
        <div className="forest-heading">
          <h1 className="forest-title">{t('forest.title')}</h1>
          <p className="forest-sub">{t('forest.subtitle')}</p>
        </div>
        <div className="forest-account">
          <span className="forest-email">{user?.email}</span>
          <div className="forest-top-actions">
            <button onClick={() => navigate('/profile')}>{t('profile.link')}</button>
            {/* Atajo al panel: solo para admins. La ruta igual valida el rol. */}
            {role === 'admin' && (
              <button onClick={() => navigate('/admin')}>{t('admin.link')}</button>
            )}
            <button onClick={handleSignOut}>{t('auth.signOut')}</button>
          </div>
        </div>
      </header>

      <div
        className="forest-map-viewport"
        role="region"
        aria-label={t('forest.title')}
        tabIndex={0}
      >
        <div className="forest-map">
          <img src={forestMap} alt={t('forest.title')} draggable={false} />

          {missionPositions.map((position, index) => {
            const n = index + 1;
            const m = byNumero.get(n);
            const isDone = m ? completed.has(m.id) : false;
            const title = m?.titulo || t('forest.comingSoon');

            return (
              <button
                key={n}
                className={`mission-node ${isDone ? 'done' : ''}`}
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                aria-label={`${t('forest.modalTitle', { numero: n })}: ${title}`}
                onClick={() => setSelected({ numero: n, titulo: m?.titulo ?? '' })}
              >
                <span className="mission-node-num">{n}</span>
                <span className="mission-node-title">{title}</span>
                {isDone && <span className="mission-node-token">🪙</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('forest.modalTitle', { numero: selected.numero })}</h2>
            {selected.titulo && (
              <p className="modal-mission-title">{selected.titulo}</p>
            )}
            <p>{t('forest.modalAsk')}</p>
            <div className="modal-actions">
              <button
                className="modal-primary"
                onClick={() => navigate(`/mission/${selected.numero}`)}
              >
                {t('forest.enter')}
              </button>
              <button className="modal-ghost" onClick={() => setSelected(null)}>
                {t('common.backToMap')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
