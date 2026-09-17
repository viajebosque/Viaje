import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { watchTokenCelebration } from '../lib/tokenCelebration';

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

    return watchTokenCelebration(reward, tokenImage, confetti.create);
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
