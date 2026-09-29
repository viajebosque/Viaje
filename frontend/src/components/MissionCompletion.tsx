import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import MissionTokenReward from './MissionTokenReward';
import CelebrateButton from './CelebrateButton';
import { getMissionTokenImage } from '../lib/missionTokens';
import { TOTAL_MISSIONS } from '../lib/missions';
import forestMap from '../assets/forest/forest-map.png';

type Props = {
  numero: number;
  onContinue: () => void;
  replay?: number;
  children?: ReactNode;
};

export default function MissionCompletion({ numero, onContinue, replay = 0, children }: Props) {
  const { t } = useTranslation();
  const tokenImage = getMissionTokenImage(numero);
  const isFirstMission = numero === 1;
  const isFinalMission = numero === TOTAL_MISSIONS;
  // Qué representa el token (sección "Lo que representa" de cada misión en
  // los .docx) y el adelanto de la misión siguiente. Un texto vacío en el
  // i18n esconde el bloque: así se cargan de a uno sin tocar código.
  const rewardMeaning = t(`mission.guided.rewardMeanings.${numero}`, { defaultValue: '' });
  const nextStep = t(`mission.guided.nextSteps.${numero}`, { defaultValue: '' });

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
        {rewardMeaning && <p className="guided-reward-meaning">{rewardMeaning}</p>}
        <CelebrateButton key={numero} />
        {nextStep && (
          <section className="guided-consequence">
            <p>{nextStep}</p>
          </section>
        )}
        <button className="guided-primary" type="button" onClick={onContinue}>
          {t(isFinalMission ? 'mission.guided.completionFinish' : 'mission.guided.completionContinue')}
        </button>
      </section>
    </main>
  );
}
