import { useTranslation } from 'react-i18next';
import { LANGS } from './index';
import { useLanguage } from './useLanguage';

// Toggle ES | EN. Visible en todas las pantallas.
export default function LangToggle() {
  const { t } = useTranslation();
  const { lang, change } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.switch')}>
      <svg className="lang-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" />
      </svg>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === lang ? 'active' : ''}
          aria-pressed={l === lang}
          onClick={() => void change(l)}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
