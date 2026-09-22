import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import MissionTokenReward from './MissionTokenReward';
import CelebrateButton from './CelebrateButton';
import { getMissionTokenImage } from '../lib/missionTokens';
import forestMap from '../assets/forest/forest-map.png';

type Props = {
  numero: number;
  closingText?: string;
  onContinue: () => void;
  replay?: number;
  children?: ReactNode;
};

export default function MissionCompletion({ numero, closingText, onContinue, replay = 0, children }: Props) {
  const { t } = useTranslation();
  const tokenImage = getMissionTokenImage(numero);
  const isFirstMission = numero === 1;

  return (
    <main
      className="guided-mission guided-mission--complete"
      style={{ '--guided-forest': `url(${forestMap})` } as React.CSSProperties}
    >
      {children}
      <section className="guided-celebration" aria-labelledby="guided-complete-title">
        <span className="guided-celebration-kicker">{t('mission.guided.completeKicker')}</span>
        {tokenImage && (
          <MissionTokenReward
            key={`${numero}-${replay}`}
            src={tokenImage}
            alt={t('mission.tokenImageAlt', { numero })}
            large
          />
        )}
        <h1 id="guided-complete-title">
          {isFirstMission
            ? t('mission.guided.completeTitle')
            : t('mission.guided.completeTitleGeneric', { numero })}
        </h1>
        <p className="guided-reward">
          {t(isFirstMission ? 'mission.guided.reward' : 'mission.guided.rewardGeneric')}
        </p>
        {(isFirstMission || closingText) && (
          <p className="guided-reward-meaning">
            {isFirstMission ? t('mission.guided.rewardMeaning') : closingText}
          </p>
        )}
        <CelebrateButton key={numero} />
        <section className="guided-consequence" aria-labelledby="guided-consequence-title">
          <div className="guided-consequence-heading">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M19 4C10 3 4 7 5 13c1 5 8 7 12 2 2-3 2-7 2-11Z" />
              <path d="M4 21 15 9M8 17v-5M11 14h5" />
            </svg>
            <h2 id="guided-consequence-title">
              {t(isFirstMission ? 'mission.guided.consequence.firstTitle' : 'mission.guided.consequence.title')}
            </h2>
          </div>
          <p>{t(`mission.guided.consequence.texts.${numero}`)}</p>
        </section>
        <button className="guided-primary" type="button" onClick={onContinue}>
          {t('mission.guided.backToMap')}
        </button>
      </section>
    </main>
  );
}
