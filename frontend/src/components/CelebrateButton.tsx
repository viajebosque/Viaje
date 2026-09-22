import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

export default function CelebrateButton() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>();
  const confettiRef = useRef<ReturnType<typeof confetti.create>>();

  useEffect(() => () => {
    confettiRef.current?.reset();
    canvasRef.current?.remove();
    confettiRef.current = undefined;
    canvasRef.current = undefined;
  }, []);

  const celebrate = () => {
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.className = 'mission-token-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      canvasRef.current = canvas;
      // El movimiento se solicita explícitamente con el botón. La celebración
      // automática del token sigue respetando la preferencia de accesibilidad.
      confettiRef.current = confetti.create(canvas, { resize: true, disableForReducedMotion: false });
    }
    confettiRef.current?.reset();
    void confettiRef.current?.({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#D4A329', '#F4C95D', '#FFE599', '#FFF4CC', '#B8860B'],
    });
  };

  return (
    <button className="guided-secondary guided-celebrate" type="button" onClick={celebrate}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
        <path d="m4 20 3-10 7 7-10 3ZM13 3v3M18 6l-2 2M21 12h-3M7 4l1 2M18 19l2 1" />
      </svg>
      {t('mission.guided.celebrate')}
    </button>
  );
}
