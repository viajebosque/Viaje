import { useEffect, useRef } from 'react';

type Props = {
  src: string;
  alt: string;
  large?: boolean;
};

const STAR_COUNT = 10;

export default function MissionTokenReward({ src, alt, large = false }: Props) {
  const rewardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const reward = rewardRef.current;
    const tokenImage = imageRef.current;
    if (!reward || !tokenImage) return;

    let cancelled = false;

    const replayAnimation = () => {
      reward.classList.remove('mission-token-reveal--animate');
      void reward.offsetWidth;
      reward.classList.add('mission-token-reveal--animate');
    };

    const startFirstAnimation = () => {
      if (cancelled) return;
      reward.classList.remove('mission-token-reveal--pending');
      replayAnimation();
    };

    if (tokenImage.complete) {
      void tokenImage.decode().catch(() => undefined).then(startFirstAnimation);
    } else {
      tokenImage.addEventListener('load', startFirstAnimation, { once: true });
      tokenImage.addEventListener('error', startFirstAnimation, { once: true });
    }

    let hasObserved = false;
    let wasVisible = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;

      if (!hasObserved) {
        hasObserved = true;
        wasVisible = entry.isIntersecting;
        return;
      }

      if (entry.isIntersecting && !wasVisible) replayAnimation();
      wasVisible = entry.isIntersecting;
    }, { threshold: 0.35 });

    const replayWhenTabReturns = () => {
      if (document.visibilityState !== 'visible') return;
      const rect = reward.getBoundingClientRect();
      const isOnScreen = rect.bottom > 0 && rect.top < window.innerHeight;
      if (isOnScreen) replayAnimation();
    };

    observer.observe(reward);
    document.addEventListener('visibilitychange', replayWhenTabReturns);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', replayWhenTabReturns);
      tokenImage.removeEventListener('load', startFirstAnimation);
      tokenImage.removeEventListener('error', startFirstAnimation);
    };
  }, [src]);

  return (
    <div
      ref={rewardRef}
      className={`mission-token-reveal mission-token-reveal--pending${large ? ' mission-token-reveal--large' : ''}`}
    >
      <div className="mission-token-glow" aria-hidden="true" />
      <img ref={imageRef} className="mission-token-image" src={src} alt={alt} />
      <div className="mission-token-stars" aria-hidden="true">
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
