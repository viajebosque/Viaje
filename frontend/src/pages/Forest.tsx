import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/useLanguage';
import {
  getMissions,
  getCompletedMissionIds,
  type Mission,
} from '../lib/missions';

export default function Forest() {
  const { user, signOut } = useAuth();
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
        <div className="forest-top-actions">
          <button onClick={handleSignOut}>{t('auth.signOut')}</button>
        </div>
      </header>

      <h1 className="forest-title">{t('forest.title')}</h1>
      <p className="forest-sub">{t('forest.subtitle')}</p>

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
                {m?.titulo || t('forest.comingSoon')}
              </span>
              {isDone && <span className="mission-node-token">🪙</span>}
            </button>
          );
        })}
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
