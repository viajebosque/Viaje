import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMissionTokenImage } from '../lib/missionTokens';
import { TOTAL_MISSIONS } from '../lib/missions';

type Props = {
  forestImage: string;
  onClose: () => void;
  // Reinicia el viaje en la base. true = reiniciado; false o error = no se pudo.
  onReset: () => Promise<boolean>;
};

const missionNumbers = Array.from({ length: TOTAL_MISSIONS }, (_, index) => index + 1);

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

// Cierre del viaje: aparece en el mapa al volver de la última misión. Tiene
// dos vistas en el mismo modal: la celebración con los 9 tokens y la
// confirmación antes de reiniciar (borra respuestas y tokens, no el pago).
export default function JourneyCompleteModal({ forestImage, onClose, onReset }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'celebrate' | 'confirm'>('celebrate');
  const [resetting, setResetting] = useState(false);
  // Se guarda la clave, no el texto: si cambia el idioma, el aviso también.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // Los tokens aparecen de uno en uno solo la primera vez. Si la persona
  // cancela el reinicio, vuelve a verlos quietos.
  const playedRef = useRef(false);
  const animateTokens = !playedRef.current;
  useEffect(() => {
    if (view === 'celebrate') playedRef.current = true;
  }, [view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || resetting) return;
      if (view === 'confirm') setView('celebrate');
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, resetting, onClose]);

  async function confirmReset() {
    setResetting(true);
    setErrorKey(null);
    try {
      const ok = await onReset();
      if (!ok) setErrorKey('forest.journeyEnd.error');
    } catch (error) {
      console.error(error);
      setErrorKey('forest.journeyEnd.error');
    } finally {
      setResetting(false);
    }
  }

  function cancelReset() {
    setErrorKey(null);
    setView('celebrate');
  }

  return (
    <div
      className="modal-backdrop reminders-backdrop journey-end-backdrop"
      onClick={() => {
        if (view === 'celebrate') onClose();
      }}
    >
      {view === 'celebrate' ? (
        <section
          className="reminders-modal journey-end-modal"
          style={{ '--reminders-forest': `url(${forestImage})` } as React.CSSProperties}
          role="dialog"
          aria-modal="true"
          aria-labelledby="journey-end-title"
          aria-describedby="journey-end-intro"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="reminders-close"
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>

          <header className="reminders-header journey-end-header">
            <p className="reminders-eyebrow">{t('forest.journeyEnd.eyebrow')}</p>
            <h2 id="journey-end-title">{t('forest.journeyEnd.title')}</h2>
            <p id="journey-end-intro" className="reminders-intro">
              {t('forest.journeyEnd.intro')}
            </p>
          </header>

          <ol
            className={`journey-end-tokens${animateTokens ? ' journey-end-tokens--animate' : ''}`}
            aria-label={t('forest.journeyEnd.tokensLabel', { total: TOTAL_MISSIONS })}
          >
            {missionNumbers.map((numero, index) => (
              <li
                key={numero}
                className="journey-end-token"
                style={{ '--journey-end-index': index } as React.CSSProperties}
              >
                <img
                  src={getMissionTokenImage(numero)}
                  alt={t('mission.tokenImageAlt', { numero })}
                  draggable={false}
                />
              </li>
            ))}
          </ol>

          <p className="journey-end-closing">{t('forest.journeyEnd.closing')}</p>

          <div className="journey-end-actions">
            <button className="reminders-return journey-end-primary" type="button" autoFocus onClick={onClose}>
              {t('common.backToMap')}
            </button>
            <button className="journey-end-secondary" type="button" onClick={() => setView('confirm')}>
              {t('forest.journeyEnd.restart')}
            </button>
          </div>
        </section>
      ) : (
        <section
          className="reminders-modal journey-end-modal journey-end-confirm"
          style={{ '--reminders-forest': `url(${forestImage})` } as React.CSSProperties}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="journey-end-confirm-title"
          aria-describedby="journey-end-confirm-body"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="reminders-header journey-end-header">
            <h2 id="journey-end-confirm-title">{t('forest.journeyEnd.confirmTitle')}</h2>
          </header>
          <div id="journey-end-confirm-body" className="journey-end-confirm-body">
            <p>{t('forest.journeyEnd.confirmBody')}</p>
            <p className="journey-end-confirm-keep">{t('forest.journeyEnd.confirmKeep')}</p>
          </div>

          <p className="journey-end-error" role="alert">
            {errorKey ? t(errorKey) : ''}
          </p>

          <div className="journey-end-actions">
            <button
              className="journey-end-danger"
              type="button"
              disabled={resetting}
              onClick={confirmReset}
            >
              {t(resetting ? 'forest.journeyEnd.restarting' : 'forest.journeyEnd.confirmYes')}
            </button>
            <button
              className="journey-end-secondary"
              type="button"
              autoFocus
              disabled={resetting}
              onClick={cancelReset}
            >
              {t('forest.journeyEnd.confirmCancel')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
