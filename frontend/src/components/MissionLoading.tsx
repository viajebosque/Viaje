import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import forestMap from '../assets/forest/forest-map.png';
import branchTop from '../assets/auth/branch-top.webp';
import branchBottom from '../assets/auth/branch-bottom.webp';

export default function MissionLoading({ numero }: { numero?: number }) {
  const { t } = useTranslation();
  const hasMission = typeof numero === 'number' && Number.isInteger(numero) && numero >= 1 && numero <= 9;

  return (
    <main className="mission-loading" style={{ '--loading-forest': `url(${forestMap})` } as CSSProperties}>
      <section className="mission-loading-card" aria-labelledby="mission-loading-title">
        <img className="mission-loading-branch mission-loading-branch--top" src={branchTop} alt="" aria-hidden="true" />
        <img className="mission-loading-branch mission-loading-branch--bottom" src={branchBottom} alt="" aria-hidden="true" />
        <p className="mission-loading-eyebrow">
          {hasMission ? t('forest.modalTitle', { numero }) : t('mission.loadingScene.eyebrow')}
        </p>
        <div className="mission-loading-emblem" aria-hidden="true">
          <span className="mission-loading-orbit" />
          <svg viewBox="0 0 80 80" fill="none">
            <path className="mission-loading-leaf" d="M41 43C39 26 48 15 65 15c1 17-8 28-24 28Z" />
            <path className="mission-loading-leaf mission-loading-leaf--small" d="M39 49C23 50 15 40 15 28c15-1 25 7 24 21Z" />
            <path className="mission-loading-stem" d="M40 65V44L56 25M40 52 24 36M28 66h24" />
          </svg>
          <span className="mission-loading-spark mission-loading-spark--one" />
          <span className="mission-loading-spark mission-loading-spark--two" />
        </div>
        <h1 id="mission-loading-title">{t('mission.loadingScene.title')}</h1>
        <p className="mission-loading-message">{t('mission.loadingScene.message')}</p>
        <div className="mission-loading-track" aria-hidden="true"><span /></div>
        <p className="mission-loading-status" role="status" aria-live="polite">
          {t('mission.loading')}
        </p>
      </section>
    </main>
  );
}
