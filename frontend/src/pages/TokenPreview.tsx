import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import MissionTokenReward from '../components/MissionTokenReward';
import { getMissionTokenImage } from '../lib/missionTokens';
import forestMap from '../assets/forest/forest-map.png';

// Vista de prueba sin escrituras: no entrega tokens ni modifica respuestas.
export default function TokenPreview() {
  const { t } = useTranslation();
  const [replay, setReplay] = useState(0);
  const manualCanvas = useRef<HTMLCanvasElement>();
  const manualConfetti = useRef<ReturnType<typeof confetti.create>>();
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => () => {
    manualConfetti.current?.reset();
    manualCanvas.current?.remove();
  }, []);

  const launchConfetti = () => {
    if (!manualCanvas.current) {
      const canvas = document.createElement('canvas');
      canvas.className = 'mission-token-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      manualCanvas.current = canvas;
      // Solo esta acción explícita permite probar el movimiento con la preferencia activada.
      manualConfetti.current = confetti.create(canvas, { resize: true, disableForReducedMotion: false });
    }
    manualConfetti.current?.reset();
    void manualConfetti.current?.({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#D4A329', '#F4C95D', '#FFE599', '#FFF4CC', '#B8860B'],
    });
  };

  return (
    <main
      className="guided-mission guided-mission--complete"
      style={{ '--guided-forest': `url(${forestMap})`, overflowY: 'auto', alignItems: 'start' } as React.CSSProperties}
    >
      <section className="guided-celebration" aria-labelledby="token-preview-title">
        <h1 id="token-preview-title">{t('mission.guided.tokenPreviewTitle')}</h1>
        <MissionTokenReward key={replay} src={getMissionTokenImage(1)!} alt={t('mission.tokenImageAlt', { numero: 1 })} large />
        <p className="guided-reward" id="token-preview-motion" role="status">
          {t(reducedMotion ? 'mission.guided.tokenPreviewReduced' : 'mission.guided.tokenPreviewEnabled')}
        </p>
        <button className="guided-primary" type="button" aria-describedby="token-preview-motion" onClick={launchConfetti}>
          {t('mission.guided.tokenPreviewLaunch')}
        </button>
        <button className="guided-secondary" style={{ marginTop: '1rem' }} type="button" onClick={() => setReplay((value) => value + 1)}>
          {t('mission.guided.tokenPreviewReplay')}
        </button>
        <p>{t('mission.guided.tokenPreviewNotice')}</p>
      </section>
    </main>
  );
}
