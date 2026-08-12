import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/useRole';
import { useLanguage } from '../i18n/useLanguage';
import forestMap from '../assets/forest/forest-map.png';
import pendingCheckpoint from '../assets/forest/checkpoint-pending.png';
import missionOnePanel from '../assets/forest/mission-one-panel.png';
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

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 16-1 4 4-1L19 8l-3-3L5 16Z" />
      <path d="m13.8 7.2 3 3M5 16l3 3" />
    </svg>
  );
}

function StepsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="8" cy="8" rx="2.5" ry="4" transform="rotate(-18 8 8)" />
      <ellipse cx="15.5" cy="15.5" rx="2.5" ry="4" transform="rotate(22 15.5 15.5)" />
      <circle cx="6.4" cy="14.2" r="1.2" />
      <circle cx="17" cy="9.5" r="1.2" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg viewBox="0 0 38 38" aria-hidden="true">
      <path d="M19 31V13" />
      <path d="M19 19c-6 0-9-3-9-8 6 0 9 3 9 8ZM19 24c6 0 10-3 10-8-6 0-10 3-10 8Z" />
      <path d="M8 32c6-3 16-3 22 0" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export default function Forest() {
  const { signOut } = useAuth();
  const { role } = useRole();
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isDesignPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === '1';

  function openMission(numero: number) {
    navigate(`/mission/${numero}${isDesignPreview ? '?preview=1' : ''}`);
  }

  const [missions, setMissions] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{
    numero: number;
    titulo: string;
    descripcion: string;
    isDone: boolean;
  } | null>(null);

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

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

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
            const previewTitle =
              isDesignPreview && n === 1 ? t('forest.missionOnePreviewTitle') : '';
            const previewDescription =
              isDesignPreview && n === 1
                ? t('forest.missionOnePreviewDescription')
                : '';
            const title = m?.titulo || previewTitle || t('forest.comingSoon');

            return (
              <button
                key={n}
                className={`mission-node ${isDone ? 'done' : 'pending'}`}
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                aria-label={`${t('forest.modalTitle', { numero: n })}: ${title}`}
                onClick={() =>
                  setSelected({
                    numero: n,
                    titulo: m?.titulo || previewTitle,
                    descripcion: m?.descripcion || previewDescription,
                    isDone,
                  })
                }
              >
                {!isDone && (
                  <img
                    className="mission-checkpoint"
                    src={pendingCheckpoint}
                    alt=""
                    draggable={false}
                  />
                )}
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
          {selected.numero === 1 ? (
            <section
              className="mission-entry-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mission-entry-title"
              aria-describedby="mission-entry-description"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                className="mission-entry-background"
                src={missionOnePanel}
                alt=""
                draggable={false}
              />
              <button
                className="mission-entry-close"
                type="button"
                aria-label={t('common.close')}
                autoFocus
                onClick={() => setSelected(null)}
              >
                <CloseIcon />
              </button>

              <div className="mission-entry-content">
                <p className="mission-entry-label">
                  {t('forest.modalTitle', { numero: selected.numero })}
                </p>
                <h2 id="mission-entry-title">
                  {selected.titulo || t('forest.modalTitle', { numero: selected.numero })}
                </h2>
                <p id="mission-entry-description" className="mission-entry-description">
                  {selected.descripcion || t('forest.modalAsk')}
                </p>

                <div className="mission-entry-facts">
                  <div className="mission-entry-fact">
                    <ClockIcon />
                    <span>{t('forest.modalDuration')}</span>
                  </div>
                  <div className="mission-entry-fact">
                    <PencilIcon />
                    <span>{t('forest.modalMaterials')}</span>
                  </div>
                  <div className="mission-entry-fact">
                    <StepsIcon />
                    <span>
                      {t('forest.modalSteps', {
                        current: selected.isDone ? 3 : 0,
                        total: 3,
                      })}
                    </span>
                  </div>
                </div>

                <div className="mission-entry-note">
                  <SproutIcon />
                  <span>{t('forest.modalHint')}</span>
                </div>

                <div className="mission-entry-actions">
                  <button
                    className="mission-entry-primary"
                    type="button"
                    onClick={() => openMission(selected.numero)}
                  >
                    {t('forest.enter')}
                  </button>
                  <button
                    className="mission-entry-back"
                    type="button"
                    onClick={() => setSelected(null)}
                  >
                    {t('common.backToMap')}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>{t('forest.modalTitle', { numero: selected.numero })}</h2>
              {selected.titulo && (
                <p className="modal-mission-title">{selected.titulo}</p>
              )}
              <p>{t('forest.modalAsk')}</p>
              <div className="modal-actions">
                <button
                  className="modal-primary"
                  onClick={() => openMission(selected.numero)}
                >
                  {t('forest.enter')}
                </button>
                <button className="modal-ghost" onClick={() => setSelected(null)}>
                  {t('common.backToMap')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
