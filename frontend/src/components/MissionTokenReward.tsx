import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

type Props = {
  src: string;
  alt: string;
  large?: boolean;
};

const STAR_COUNT = 10;
const GOLD_COLORS = ['#D4A329', '#F4C95D', '#FFE599', '#FFF4CC', '#B8860B'];

export default function MissionTokenReward({ src, alt, large = false }: Props) {
  const rewardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const reward = rewardRef.current;
    const tokenImage = imageRef.current;
    if (!reward || !tokenImage) return;

    let cancelled = false;
    let imageReady = false;
    let visible = false;
    let started = false;
    let canvas: HTMLCanvasElement | undefined;
    let celebration: ReturnType<typeof confetti.create> | undefined;
    let burstTimer: number | undefined;

    const startAnimation = () => {
      if (cancelled || started || !imageReady || !visible || document.visibilityState !== 'visible') return;
      started = true;
      reward.classList.remove('mission-token-reveal--pending');
      reward.classList.remove('mission-token-reveal--animate');
      void reward.offsetWidth;
      reward.classList.add('mission-token-reveal--animate');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // A viewport canvas lets particles travel beyond the reward card without clipping.
      canvas = document.createElement('canvas');
      canvas.className = 'mission-token-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      celebration = confetti.create(canvas, { resize: true, disableForReducedMotion: true });

      const burst = () => {
        const rect = reward.getBoundingClientRect();
        if (document.visibilityState !== 'visible' || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
        void celebration?.({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: GOLD_COLORS,
        });
      };

      // Fire the Basic Cannon once, in sync with the token's entrance.
      burstTimer = window.setTimeout(burst, 420);
    };

    const startFirstAnimation = () => {
      if (cancelled) return;
      imageReady = true;
      startAnimation();
    };

    if (tokenImage.complete) {
      void tokenImage.decode().catch(() => undefined).then(startFirstAnimation);
    } else {
      tokenImage.addEventListener('load', startFirstAnimation, { once: true });
      tokenImage.addEventListener('error', startFirstAnimation, { once: true });
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      startAnimation();
    }, { threshold: 0.35 });

    observer.observe(reward);
    document.addEventListener('visibilitychange', startAnimation);

    return () => {
      cancelled = true;
      window.clearTimeout(burstTimer);
      celebration?.reset();
      canvas?.remove();
      observer.disconnect();
      document.removeEventListener('visibilitychange', startAnimation);
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
