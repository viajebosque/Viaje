import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import forestMap from '../assets/forest/forest-map.png';

type JourneyPageShellProps = {
  pageClassName: string;
  shellClassName: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  emblem: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
};

export default function JourneyPageShell({
  pageClassName,
  shellClassName,
  eyebrow,
  title,
  subtitle,
  emblem,
  badge,
  children,
}: JourneyPageShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <main
      className={`journey-page ${pageClassName}`}
      style={{ '--journey-forest': `url(${forestMap})` } as CSSProperties}
    >
      <section className={`journey-shell ${shellClassName}`}>
        <header className="journey-header">
          <button
            className="journey-back"
            type="button"
            onClick={() => navigate('/forest')}
          >
            <span aria-hidden="true">←</span>
            {t('common.backToMap')}
          </button>

          <div className="journey-heading">
            <span className="journey-emblem" aria-hidden="true">
              {emblem}
            </span>
            <div>
              <p className="journey-eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p className="journey-subtitle">{subtitle}</p>
            </div>
          </div>

          {badge && <div className="journey-header-badge">{badge}</div>}
        </header>

        <div className="journey-content">{children}</div>
      </section>
    </main>
  );
}
