import { useEffect, useRef } from 'react';

type Props = {
  src: string;
  alt: string;
  large?: boolean;
};

const STAR_COUNT = 10;

export default function MissionTokenReward({ src, alt, large = false }: Props) {
  const rewardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reward = rewardRef.current;
    if (!reward) return;

    const replayAnimation = () => {
      reward.classList.remove('mission-token-reveal--animate');
      void reward.offsetWidth;
      reward.classList.add('mission-token-reveal--animate');
    };

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
      observer.disconnect();
      document.removeEventListener('visibilitychange', replayWhenTabReturns);
    };
  }, [src]);

  return (
    <div
      ref={rewardRef}
      className={`mission-token-reveal mission-token-reveal--animate${large ? ' mission-token-reveal--large' : ''}`}
    >
      <div className="mission-token-glow" aria-hidden="true" />
      <img className="mission-token-image" src={src} alt={alt} />
      <div className="mission-token-stars" aria-hidden="true">
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
