import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLang, type Lang } from '../i18n';
import { getMissionTokenImage } from '../lib/missionTokens';
import { TOTAL_MISSIONS } from '../lib/missions';
import { whatsappUrl } from '../lib/payment';

type Props = {
  forestImage: string;
  onClose: () => void;
  // Reinicia el viaje en la base. true = reiniciado; false o error = no se pudo.
  onReset: () => Promise<boolean>;
};

// Pasos del cierre, en orden: los 9 tokens → video → carta de despedida con
// contacto y las salidas. 'confirm' es la confirmación antes de reiniciar.
type View = 'tokens' | 'video' | 'letter' | 'confirm';

const missionNumbers = Array.from({ length: TOTAL_MISSIONS }, (_, index) => index + 1);
const letterKeys = ['letter1', 'letter2', 'letter3'] as const;

// Video de cierre (YouTube Shorts), uno por idioma. Como los de las misiones
// (lib/missionVideos.ts), están en el código y no en la base.
const CLOSING_VIDEOS: Record<Lang, string> = {
  es: 'Rq2ELuRlCUc',
  en: 'hICALFLF9DE',
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5m6-6-6 6 6 6" />
    </svg>
  );
}

// Cierre del viaje: aparece en el mapa al volver de la última misión. No tiene
// ✕ ni se cierra con el fondo o Escape: se recorre paso a paso y la salida es
// "Volver al mapa" (o reiniciar) en el último paso.
export default function JourneyCompleteModal({ forestImage, onClose, onReset }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('tokens');
  const [resetting, setResetting] = useState(false);
  // Se guarda la clave, no el texto: si cambia el idioma, el aviso también.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // Los tokens aparecen de uno en uno solo la primera vez: si la persona
  // vuelve con la flecha, los ve quietos.
  const leftTokensRef = useRef(false);
  const animateTokens = !leftTokensRef.current;

  function goTo(next: View) {
    if (view === 'tokens') leftTokensRef.current = true;
    setView(next);
  }

  // Escape solo sirve para salir de la confirmación, de vuelta a la carta.
  useEffect(() => {
    if (view !== 'confirm') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || resetting) return;
      setErrorKey(null);
      setView('letter');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, resetting]);

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
    setView('letter');
  }

  const modalStyle = { '--reminders-forest': `url(${forestImage})` } as React.CSSProperties;

  return (
    <div className="modal-backdrop reminders-backdrop journey-end-backdrop">
      {view === 'tokens' && (
        <section
          className="reminders-modal journey-end-modal"
          style={modalStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="journey-end-title"
          aria-describedby="journey-end-intro"
        >
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

          <div className="journey-end-actions">
            <button
              className="reminders-return journey-end-primary"
              type="button"
              autoFocus
              onClick={() => goTo('video')}
            >
              {t('forest.journeyEnd.continue')}
            </button>
          </div>
        </section>
      )}

      {view === 'video' && (
        <section
          className="reminders-modal journey-end-modal"
          style={modalStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="journey-end-video-title"
        >
          <button
            className="reminders-close journey-end-back"
            type="button"
            aria-label={t('forest.journeyEnd.previous')}
            onClick={() => goTo('tokens')}
          >
            <BackIcon />
          </button>
          <h2 id="journey-end-video-title" className="sr-only">
            {t('forest.journeyEnd.videoTitle')}
          </h2>
          {/* Mismo embed que el video de actividad de las misiones. */}
          <div className="journey-end-video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${CLOSING_VIDEOS[currentLang()]}`}
              title={t('forest.journeyEnd.videoTitle')}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>

          <div className="journey-end-actions">
            <button
              className="reminders-return journey-end-primary"
              type="button"
              autoFocus
              onClick={() => goTo('letter')}
            >
              {t('forest.journeyEnd.continue')}
            </button>
          </div>
        </section>
      )}

      {view === 'letter' && (
        <section
          className="reminders-modal journey-end-modal journey-end-letter-modal"
          style={modalStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="journey-end-letter-title"
          aria-describedby="journey-end-letter"
        >
          <button
            className="reminders-close journey-end-back"
            type="button"
            aria-label={t('forest.journeyEnd.previous')}
            onClick={() => goTo('video')}
          >
            <BackIcon />
          </button>
          <h2 id="journey-end-letter-title" className="sr-only">
            {t('forest.journeyEnd.eyebrow')}
          </h2>
          <div id="journey-end-letter" className="journey-end-letter">
            {letterKeys.map((key) => (
              <p key={key}>{t(`forest.journeyEnd.${key}`)}</p>
            ))}
            <p className="journey-end-signature">{t('forest.journeyEnd.signature')}</p>
            <p>{t('forest.journeyEnd.contactHere')}</p>
          </div>

          <div className="journey-end-actions">
            {/* Mismo WhatsApp que el muro de pago; el mensaje sale del
                idioma activo (forest.journeyEnd.contactMessage). */}
            <a
              className="reminders-return journey-end-primary"
              href={whatsappUrl(t('forest.journeyEnd.contactMessage'))}
              target="_blank"
              rel="noreferrer noopener"
              autoFocus
            >
              {t('forest.journeyEnd.contact')}
            </a>
            <button className="journey-end-secondary" type="button" onClick={onClose}>
              {t('common.backToMap')}
            </button>
            <button className="journey-end-secondary" type="button" onClick={() => setView('confirm')}>
              {t('forest.journeyEnd.restart')}
            </button>
          </div>
        </section>
      )}

      {view === 'confirm' && (
        <section
          className="reminders-modal journey-end-modal journey-end-confirm"
          style={modalStyle}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="journey-end-confirm-title"
          aria-describedby="journey-end-confirm-body"
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
