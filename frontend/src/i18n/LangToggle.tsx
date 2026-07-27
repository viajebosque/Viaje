import { useTranslation } from 'react-i18next';
import { LANGS } from './index';
import { useLanguage } from './useLanguage';

// Toggle ES | EN. Visible en todas las pantallas.
export default function LangToggle() {
  const { t } = useTranslation();
  const { lang, change } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.switch')}>
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
