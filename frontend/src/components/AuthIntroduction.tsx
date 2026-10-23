import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLang, type Lang } from '../i18n';
import { getWelcomeVideoId } from '../lib/videos';
import YouTubeVideo from './YouTubeVideo';
import MissionGuide from './MissionGuide';

// Video de bienvenida: sale de la tabla `videos` (SQL/021), uno por idioma. Es
// la única fila que se lee sin sesión.
function IntroductionVideo({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const load = useCallback(() => getWelcomeVideoId(lang), [lang]);
  return (
    <YouTubeVideo
      className="auth-intro-video"
      load={load}
      lang={lang}
      title={t('auth.intro.videoTitle')}
    />
  );
}

export type IntroStep = 'video' | 'about' | 'structure';
type StepperStep = IntroStep | 'access';
const STEPS: StepperStep[] = ['video', 'about', 'structure', 'access'];

// Los pasos ya vistos se pueden volver a abrir con un click: así, desde el
// login, la persona puede volver a mirar el video o el texto del viaje.
export function IntroStepper({
  current,
  onSelect,
}: {
  current: StepperStep;
  onSelect: (step: IntroStep) => void;
}) {
  const { t } = useTranslation();
  const currentIndex = STEPS.indexOf(current);

  return (
    <ol className="auth-intro-steps" aria-label={t('auth.intro.stepsLabel')}>
      {STEPS.map((item, index) => {
        const label = (
          <>
            <span className="auth-intro-step-num" aria-hidden="true">{index + 1}</span>
            <span className="auth-intro-step-label">{t(`auth.intro.steps.${item}`)}</span>
          </>
        );
        return (
          <li key={item} aria-current={current === item ? 'step' : undefined}>
            {item !== 'access' && index < currentIndex ? (
              <button type="button" onClick={() => onSelect(item)}>{label}</button>
            ) : (
              label
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function AuthIntroduction({
  initialStep = 'video',
  onContinue,
}: {
  initialStep?: IntroStep;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const [step, setStep] = useState<IntroStep>(initialStep);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const titleKey =
    step === 'video'
      ? 'auth.intro.title'
      : step === 'about'
        ? 'auth.intro.aboutTitle'
        : 'missionGuide.title';

  return (
    <div className="auth-card-content auth-intro" ref={contentRef}>
      <IntroStepper current={step} onSelect={setStep} />
      <header className="auth-heading">
        <h2 ref={headingRef} tabIndex={-1}>{t(titleKey)}</h2>
        {step === 'video' && <p>{t('auth.intro.subtitle')}</p>}
      </header>

      {step === 'video' && (
        <>
          <IntroductionVideo key={lang} lang={lang} />
          <button className="auth-primary" type="button" onClick={() => setStep('about')}>
            {t('auth.intro.continue')}
          </button>
        </>
      )}

      {step === 'about' && (
        <>
          <div className="auth-intro-copy">
            {(['purpose', 'missions', 'presence', 'calling'] as const).map((paragraph) => (
              <p key={paragraph}>{t(`auth.intro.paragraphs.${paragraph}`)}</p>
            ))}
          </div>
          <button className="auth-primary" type="button" onClick={() => setStep('structure')}>
            {t('auth.intro.continue')}
          </button>
          <button className="auth-secondary-link" type="button" onClick={() => setStep('video')}>
            {t('auth.intro.back')}
          </button>
        </>
      )}

      {step === 'structure' && (
        <>
          <MissionGuide />
          <button className="auth-primary" type="button" onClick={onContinue}>
            {t('auth.intro.enter')}
          </button>
          <button className="auth-secondary-link" type="button" onClick={() => setStep('about')}>
            {t('auth.intro.backToAbout')}
          </button>
        </>
      )}
    </div>
  );
}
