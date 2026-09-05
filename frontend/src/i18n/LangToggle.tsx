import { useTranslation } from 'react-i18next';
import { useLanguage } from './useLanguage';

// Muestra siempre el idioma al que se puede cambiar, no el idioma activo.
export default function LangToggle() {
  const { t } = useTranslation();
  const { lang, change } = useLanguage();
  const nextLang = lang === 'es' ? 'en' : 'es';
  const switchLabel = t(`lang.switchTo.${nextLang}`);

  return (
    <button
      className="lang-toggle"
      type="button"
      title={switchLabel}
      aria-label={switchLabel}
      onClick={() => void change(nextLang)}
    >
      <svg className="lang-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" />
      </svg>
      <span className="lang-toggle-code" aria-hidden="true">
        {t(`lang.${nextLang}`)}
      </span>
    </button>
  );
}
