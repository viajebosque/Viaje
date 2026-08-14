import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/useRole';
import { useLanguage } from '../i18n/useLanguage';
import forestMap from '../assets/forest/forest-map.png';
import pendingCheckpoint from '../assets/forest/checkpoint-pending.png';
import completedCheckpoint from '../assets/forest/checkpoint-completed.png';
import missionOnePanel from '../assets/forest/mission-one-panel.png';
import mapGuide from '../assets/forest/map-guide.png';
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

const reminderKeys = ['honesty', 'compassion', 'play', 'raft'] as const;

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
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
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
    let active = true;
    getCompletedMissionIds()
      .then((missionIds) => {
        if (active) {
          setCompleted(missionIds);
          setCompletedLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected && !showReminders) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setShowReminders(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected, showReminders]);

  // Mapa número -> misión (para saber título / si existe contenido).
  const byNumero = new Map(missions.map((m) => [m.numero, m]));
  const nextMissionNumber = isDesignPreview
    ? 1
    : completedLoaded
      ? missions.find((mission) => !completed.has(mission.id))?.numero ?? null
      : null;

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
            <button
              className="forest-help-button"
              type="button"
              title={t('forest.reminders.open')}
              aria-label={t('forest.reminders.open')}
              aria-haspopup="dialog"
              aria-expanded={showReminders}
              onClick={() => {
                setSelected(null);
                setShowReminders(true);
              }}
            >
              <span aria-hidden="true">?</span>
            </button>
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
            const isNext = n === nextMissionNumber;
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
                className={`mission-node ${isDone ? 'done' : 'pending'} ${isNext ? 'next' : ''}`}
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                aria-label={`${t('forest.modalTitle', { numero: n })}: ${title}${isNext ? `. ${t('forest.nextMission')}` : ''}`}
                onClick={() =>
                  setSelected({
                    numero: n,
                    titulo: m?.titulo || previewTitle,
                    descripcion: m?.descripcion || previewDescription,
                    isDone,
                  })
                }
              >
                <img
                  className="mission-checkpoint"
                  src={isDone ? completedCheckpoint : pendingCheckpoint}
                  alt=""
                  draggable={false}
                />
                {isNext && (
                  <img
                    className={`mission-guide ${n === 1 ? 'mission-guide--right' : ''}`}
                    src={mapGuide}
                    alt=""
                    draggable={false}
                  />
                )}
                <span className="mission-node-num">{n}</span>
                <span className="mission-node-title">{title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showReminders && (
        <div
          className="modal-backdrop reminders-backdrop"
          onClick={() => setShowReminders(false)}
        >
          <section
            className="reminders-modal"
            style={{ '--reminders-forest': `url(${forestMap})` } as React.CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminders-title"
            aria-describedby="reminders-intro"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="reminders-close"
              type="button"
              aria-label={t('common.close')}
              autoFocus
              onClick={() => setShowReminders(false)}
            >
              <CloseIcon />
            </button>

            <header className="reminders-header">
              <span className="reminders-emblem" aria-hidden="true">
                <SproutIcon />
              </span>
              <p className="reminders-eyebrow">{t('forest.reminders.eyebrow')}</p>
              <h2 id="reminders-title">{t('forest.reminders.title')}</h2>
              <p id="reminders-intro" className="reminders-intro">
                {t('forest.reminders.intro')}
              </p>
            </header>

            <div className="reminders-grid">
              {reminderKeys.map((key, index) => (
                <article className="reminder-card" key={key}>
                  <span className="reminder-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{t(`forest.reminders.items.${key}.title`)}</h3>
                    <p>{t(`forest.reminders.items.${key}.body`)}</p>
                  </div>
                </article>
              ))}
            </div>

            <aside className="reminders-privacy">
              <span className="reminders-privacy-icon" aria-hidden="true">🌿</span>
              <div>
                <h3>{t('forest.reminders.privacy.title')}</h3>
                <p>{t('forest.reminders.privacy.body')}</p>
              </div>
            </aside>

            <button
              className="reminders-return"
              type="button"
              onClick={() => setShowReminders(false)}
            >
              {t('forest.reminders.return')}
            </button>
          </section>
        </div>
      )}

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
