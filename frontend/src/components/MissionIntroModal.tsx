import { useEffect } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import forestMap from '../assets/forest/forest-map.png';

// Pausa antes de empezar una misión. Los textos viven en
// mission.introModal.<numero> (es.json y en.json); una misión sin esa clave
// no tiene modal. Para agregarle uno a otra misión alcanza con sumar las
// claves, sin tocar código.
const PARAGRAPHS = ['p1', 'p2', 'p3', 'p4'] as const;

export function hasMissionIntro(numero: number) {
  return i18next.exists(`mission.introModal.${numero}.p1`);
}

export default function MissionIntroModal({
  numero,
  titulo,
  onClose,
}: {
  numero: number;
  titulo: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop reminders-backdrop" onClick={onClose}>
      <section
        className="reminders-modal mission-intro-modal"
        style={{ '--reminders-forest': `url(${forestMap})` } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-intro-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="reminders-close"
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>

        <header className="reminders-header">
          <p className="reminders-eyebrow">{t('forest.modalTitle', { numero })}</p>
          <h2 id="mission-intro-title">{titulo}</h2>
        </header>

        <div className="mission-intro-copy">
          {PARAGRAPHS.map((key) => {
            const text = t(`mission.introModal.${numero}.${key}`, { defaultValue: '' });
            return text ? <p key={key}>{text}</p> : null;
          })}
        </div>

        <button className="reminders-return" type="button" autoFocus onClick={onClose}>
          {t('mission.guided.continue')}
        </button>
      </section>
    </div>
  );
}
