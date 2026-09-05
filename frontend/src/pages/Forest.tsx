import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/useRole';
import { usePaid } from '../auth/usePaid';
import { useLanguage } from '../i18n/useLanguage';
import forestMap from '../assets/forest/forest-map.png';
import pendingCheckpoint from '../assets/forest/checkpoint-pending.png';
import completedCheckpoint from '../assets/forest/checkpoint-completed.png';
import mapGuide from '../assets/forest/map-guide.png';
import { getMissionPanelImage } from '../lib/missionPanels';
import {
  getMissions,
  getCompletedMissionIds,
  FREE_MISSIONS,
  type MissionAccess,
  type MissionSummary,
} from '../lib/missions';
import { whatsappUrl } from '../lib/payment';

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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <circle cx="12" cy="15.5" r="1.3" />
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

function ProfileIcon() {
  return (
    <svg className="forest-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="forest-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.5-2.7 7.7-7 10-4.3-2.3-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="forest-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="m14 8 4 4-4 4M18 12H9" />
    </svg>
  );
}

export default function Forest() {
  const { signOut } = useAuth();
  const { role } = useRole();
  const { isPaid, checking: checkingPaid } = usePaid();
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isDesignPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === '1';

  function openMission(numero: number) {
    navigate(`/mission/${numero}${isDesignPreview ? '?preview=1' : ''}`);
  }

  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const missionNodeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const didPositionMapRef = useRef(false);
  const mapWasUsedRef = useRef(false);
  const enteredOnMobileRef = useRef(window.matchMedia('(max-width: 760px)').matches);
  // Se guarda SOLO el numero. Titulo, resumen y isDone se resuelven al
  // renderizar (selectedInfo): guardarlos acá los congelaba en el momento del
  // click, así que quedaban vacíos si los datos todavía no habían llegado y en
  // el idioma viejo si la persona movía el switch con el modal abierto.
  const [selected, setSelected] = useState<number | null>(null);

  // Re-lee las misiones al cambiar el idioma: los títulos vienen de la BD.
  useEffect(() => {
    let active = true;
    getMissions(lang)
      .then((rows) => {
        if (active) setMissions(rows);
      })
      .catch(() => {
        if (active) setMissions([]);
      });
    return () => {
      active = false;
    };
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

  // En teléfono, entra directamente a la última misión completada. Se hace una
  // sola vez por visita al mapa y se cancela si la persona ya empezó a moverlo
  // mientras terminaba de cargar su progreso.
  useEffect(() => {
    if (didPositionMapRef.current || mapWasUsedRef.current) return;
    if (
      !enteredOnMobileRef.current ||
      !window.matchMedia('(max-width: 760px)').matches
    ) {
      didPositionMapRef.current = true;
      return;
    }
    if (!isDesignPreview && (!completedLoaded || missions.length === 0)) return;

    const rawTargetNumero = isDesignPreview
      ? 1
      : missions.reduce(
          (lastNumero, mission) =>
            completed.has(mission.id) ? Math.max(lastNumero, mission.numero) : lastNumero,
          1
        );
    const targetNumero = Math.min(
      missionPositions.length,
      Math.max(1, rawTargetNumero)
    );

    const frame = window.requestAnimationFrame(() => {
      if (didPositionMapRef.current || mapWasUsedRef.current) return;

      const viewport = mapViewportRef.current;
      const node = missionNodeRefs.current[targetNumero];
      if (!viewport || !node) return;

      const viewportRect = viewport.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const viewportCenter = viewportRect.left + viewport.clientLeft + viewport.clientWidth / 2;
      const nodeCenter = nodeRect.left + nodeRect.width / 2;
      const desiredScroll = viewport.scrollLeft + nodeCenter - viewportCenter;
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

      viewport.scrollTo({
        left: Math.min(maxScroll, Math.max(0, desiredScroll)),
        behavior: 'auto',
      });
      didPositionMapRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [completed, completedLoaded, isDesignPreview, missions]);

  useEffect(() => {
    if (selected === null && !showReminders) return;
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
  const nextPendingPosition = completedLoaded
    ? missionPositions.findIndex((_, index) => {
        const mission = byNumero.get(index + 1);
        return !mission || !completed.has(mission.id);
      })
    : -1;
  const nextMissionNumber = isDesignPreview
    ? 1
    : nextPendingPosition >= 0
      ? nextPendingPosition + 1
      : null;

  // Por qué está cerrada una misión. Dos reglas encimadas:
  //
  //   paywall -> es de la 3 en adelante y el usuario no pagó. Va primero
  //              porque es el motivo que va a seguir ahí por mucho que avance;
  //              el orden, en cambio, se resuelve jugando.
  //   locked  -> le falta terminar la anterior. Como el avance es en orden,
  //              todo lo previo a la siguiente pendiente ya está hecho: basta
  //              con que el numero sea mayor que ella.
  //
  // Mientras los tokens o el perfil no llegaron no se pinta nada cerrado, para
  // no mostrar candados que después desaparecen. La pantalla de misión vuelve a
  // preguntarle a la base de todos modos.
  function accessOf(numero: number): MissionAccess {
    if (isDesignPreview) return 'open';
    if (!checkingPaid && !isPaid && numero > FREE_MISSIONS) return 'paywall';
    if (nextMissionNumber === null) return 'open';
    return numero > nextMissionNumber ? 'locked' : 'open';
  }

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  function markMapAsUsed() {
    mapWasUsedRef.current = true;
    didPositionMapRef.current = true;
  }

  const selectedPanel =
    selected !== null ? getMissionPanelImage(selected) : undefined;

  const selectedMission = selected !== null ? byNumero.get(selected) : undefined;
  const selectedInfo =
    selected === null
      ? null
      : {
          numero: selected,
          titulo:
            selectedMission?.titulo ||
            (isDesignPreview && selected === 1
              ? t('forest.missionOnePreviewTitle')
              : ''),
          descripcion:
            t(`forest.missionPanelDescriptions.${selected}`),
          isDone: selectedMission ? completed.has(selectedMission.id) : false,
          access: accessOf(selected),
          // Qué misión hay que terminar para abrir esta.
          requiredNumero: selected - 1,
        };

  // Texto de la nota y del botón segun por qué está cerrada la misión. El
  // aviso de pago es deliberadamente suave: informa, no presiona.
  const noteText =
    selectedInfo === null
      ? ''
      : selectedInfo.access === 'paywall'
        ? t('forest.paywallHint', { numero: FREE_MISSIONS })
        : selectedInfo.access === 'open'
          ? t('forest.modalHint')
          : t('forest.lockedHint', { numero: selectedInfo.requiredNumero });

  const primaryText =
    selectedInfo === null
      ? ''
      : selectedInfo.access === 'open'
        ? t('forest.enter')
        : t('forest.locked');

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
            <button
              className="forest-action-button"
              type="button"
              title={t('profile.link')}
              aria-label={t('profile.link')}
              onClick={() => navigate('/profile')}
            >
              <ProfileIcon />
              <span className="forest-action-label">{t('profile.link')}</span>
            </button>
            {/* Atajo al panel: solo para admins. La ruta igual valida el rol. */}
            {role === 'admin' && (
              <button
                className="forest-action-button"
                type="button"
                title={t('admin.link')}
                aria-label={t('admin.link')}
                onClick={() => navigate('/admin')}
              >
                <AdminIcon />
                <span className="forest-action-label">{t('admin.link')}</span>
              </button>
            )}
            <button
              className="forest-action-button"
              type="button"
              title={t('auth.signOut')}
              aria-label={t('auth.signOut')}
              onClick={handleSignOut}
            >
              <SignOutIcon />
              <span className="forest-action-label">{t('auth.signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={mapViewportRef}
        className="forest-map-viewport"
        role="region"
        aria-label={t('forest.title')}
        tabIndex={0}
        onPointerDown={markMapAsUsed}
        onWheel={markMapAsUsed}
        onKeyDown={(event) => {
          if (
            ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(
              event.key
            )
          ) {
            markMapAsUsed();
          }
        }}
      >
        <div className="forest-map">
          <img src={forestMap} alt={t('forest.title')} draggable={false} />

          {missionPositions.map((position, index) => {
            const n = index + 1;
            const m = byNumero.get(n);
            const isDone = m ? completed.has(m.id) : false;
            const isNext = n === nextMissionNumber;
            const access = accessOf(n);
            const closed = access !== 'open';
            const previewTitle =
              isDesignPreview && n === 1 ? t('forest.missionOnePreviewTitle') : '';
            const title = m?.titulo || previewTitle || t('forest.comingSoon');

            return (
              <button
                ref={(node) => {
                  missionNodeRefs.current[n] = node;
                }}
                key={n}
                className={`mission-node ${isDone ? 'done' : 'pending'} ${isNext ? 'next' : ''} ${closed ? 'locked' : ''}`}
                style={{ left: `${position.left}%`, top: `${position.top}%` }}
                aria-label={`${t('forest.modalTitle', { numero: n })}: ${title}${isNext ? `. ${t('forest.nextMission')}` : ''}${closed ? `. ${t(access === 'paywall' ? 'forest.paywallNode' : 'forest.lockedNode')}` : ''}`}
                onClick={() => setSelected(n)}
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
                {closed && (
                  <span className="mission-node-lock" aria-hidden="true">
                    <LockIcon />
                  </span>
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

      {selectedInfo && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          {selectedPanel ? (
            <section
              className={`mission-entry-modal${
                selectedInfo.titulo.length > 17 ? ' mission-entry-modal--long-title' : ''
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mission-entry-title"
              aria-describedby="mission-entry-description"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                className="mission-entry-background"
                src={selectedPanel}
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
                  {t('forest.modalTitle', { numero: selectedInfo.numero })}
                </p>
                <h2 id="mission-entry-title">
                  {selectedInfo.titulo || t('forest.modalTitle', { numero: selectedInfo.numero })}
                </h2>
                <p id="mission-entry-description" className="mission-entry-description">
                  {selectedInfo.descripcion || t('forest.modalAsk')}
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
                        current: selectedInfo.isDone ? 3 : 0,
                        total: 3,
                      })}
                    </span>
                  </div>
                </div>

                <div
                  className={`mission-entry-note ${
                    selectedInfo.access === 'open' ? '' : 'mission-entry-note--locked'
                  } ${selectedInfo.access === 'paywall' ? 'mission-entry-note--paywall' : ''}`}
                >
                  {selectedInfo.access === 'open' ? <SproutIcon /> : <LockIcon />}
                  <span>{noteText}</span>
                </div>

                <div className="mission-entry-actions">
                  {/* El aviso de pago es el único cierre con salida: en vez
                      de un botón muerto, abre WhatsApp con el mensaje ya
                      escrito en el idioma activo. */}
                  {selectedInfo.access === 'paywall' ? (
                    <a
                      className="mission-entry-primary"
                      href={whatsappUrl(t('forest.paywallMessage'))}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {t('forest.paywallCta')}
                    </a>
                  ) : (
                    <button
                      className="mission-entry-primary"
                      type="button"
                      disabled={selectedInfo.access !== 'open'}
                      onClick={() => openMission(selectedInfo.numero)}
                    >
                      {primaryText}
                    </button>
                  )}
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
              <h2>{t('forest.modalTitle', { numero: selectedInfo.numero })}</h2>
              {selectedInfo.titulo && (
                <p className="modal-mission-title">{selectedInfo.titulo}</p>
              )}
              <p>
                {selectedInfo.access === 'open' ? t('forest.modalAsk') : noteText}
              </p>
              <div className="modal-actions">
                {selectedInfo.access === 'paywall' ? (
                  <a
                    className="modal-primary"
                    href={whatsappUrl(t('forest.paywallMessage'))}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('forest.paywallCta')}
                  </a>
                ) : (
                  <button
                    className="modal-primary"
                    disabled={selectedInfo.access !== 'open'}
                    onClick={() => openMission(selectedInfo.numero)}
                  >
                    {primaryText}
                  </button>
                )}
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
