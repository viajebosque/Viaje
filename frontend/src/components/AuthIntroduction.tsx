import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLang, type Lang } from '../i18n';
import { loadYouTubePlayer } from '../lib/youtubePlayer';

const INTRO_VIDEOS: Record<Lang, string> = {
  es: 'FjlhUuiw07Y',
  en: 'M0qIKmD4vXw',
};

function IntroductionVideo({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let player: { destroy: () => void } | undefined;
    let readyTimeout: number | undefined;
    setStatus('loading');

    void loadYouTubePlayer().then((api) => {
      if (cancelled) return;
      // The API owns this iframe; React owns only its stable parent container.
      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({
        enablejsapi: '1',
        origin: window.location.origin,
        playsinline: '1',
        rel: '0',
        hl: lang,
        cc_lang_pref: lang,
      });
      iframe.src = `https://www.youtube-nocookie.com/embed/${INTRO_VIDEOS[lang]}?${params}`;
      iframe.title = t('auth.intro.videoTitle');
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      container.appendChild(iframe);
      const fail = () => {
        window.clearTimeout(readyTimeout);
        if (!cancelled) setStatus('error');
      };
      readyTimeout = window.setTimeout(fail, 15000);
      player = new api.Player(iframe, {
        events: {
          onReady: () => {
            window.clearTimeout(readyTimeout);
            if (!cancelled) setStatus('ready');
          },
          onError: fail,
        },
      });
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
      player?.destroy();
      container.replaceChildren();
    };
  }, [attempt, lang, t]);

  return (
    <>
      <div className="auth-intro-video" ref={containerRef} />
      {status === 'loading' && <p className="auth-intro-status" role="status">{t('auth.intro.loading')}</p>}
      {status === 'error' && (
        <div className="auth-intro-error">
          <p className="auth-message auth-error" role="alert">{t('auth.intro.videoError')}</p>
          <button className="auth-secondary-link" type="button" onClick={() => setAttempt((value) => value + 1)}>
            {t('auth.intro.retry')}
          </button>
        </div>
      )}
    </>
  );
}

export default function AuthIntroduction({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const [step, setStep] = useState<'video' | 'about'>('video');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div className="auth-card-content auth-intro" ref={contentRef}>
      <ol className="auth-intro-steps" aria-label={t('auth.intro.stepsLabel')}>
        {(['video', 'about', 'access'] as const).map((item, index) => (
          <li key={item} aria-current={step === item ? 'step' : undefined}>
            <span aria-hidden="true">{index + 1}</span>
            {t(`auth.intro.steps.${item}`)}
          </li>
        ))}
      </ol>
      <header className="auth-heading">
        <h2 ref={headingRef} tabIndex={-1}>
          {t(step === 'video' ? 'auth.intro.title' : 'auth.intro.aboutTitle')}
        </h2>
        {step === 'video' && <p>{t('auth.intro.subtitle')}</p>}
      </header>

      {step === 'video' ? (
        <>
          <IntroductionVideo key={lang} lang={lang} />
          <button
            className="auth-primary"
            type="button"
            onClick={() => setStep('about')}
          >
            {t('auth.intro.continue')}
          </button>
        </>
      ) : (
        <>
          <div className="auth-intro-copy">
            {(['purpose', 'missions', 'presence', 'calling'] as const).map((paragraph) => (
              <p key={paragraph}>{t(`auth.intro.paragraphs.${paragraph}`)}</p>
            ))}
          </div>
          <button className="auth-primary" type="button" onClick={onContinue}>
            {t('auth.intro.enter')}
          </button>
          <button className="auth-secondary-link" type="button" onClick={() => setStep('video')}>
            {t('auth.intro.back')}
          </button>
        </>
      )}
    </div>
  );
}
