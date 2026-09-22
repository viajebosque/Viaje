import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MissionCompletion from '../components/MissionCompletion';
import LangToggle from '../i18n/LangToggle';

// Vista de prueba sin escrituras: no entrega tokens ni modifica respuestas.
export default function TokenPreview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedMission = Number(params.get('mission') || 1);
  const numero = Number.isInteger(requestedMission) && requestedMission >= 1 && requestedMission <= 9 ? requestedMission : 1;
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
    <MissionCompletion
      numero={numero}
      replay={replay}
      onContinue={() => navigate('/forest')}
    >
      <aside className="token-preview-controls" aria-labelledby="token-preview-title">
        <h2 id="token-preview-title">{t('mission.guided.consequence.previewTitle')}</h2>
        <div className="token-preview-selection">
          <label htmlFor="token-preview-mission">{t('mission.guided.consequence.previewMission')}</label>
          <select id="token-preview-mission" value={numero} onChange={(event) => setParams({ mission: event.target.value })}>
            {Array.from({ length: 9 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{t('forest.modalTitle', { numero: index + 1 })}</option>
            ))}
          </select>
          <LangToggle />
        </div>
        <p>{t('mission.guided.tokenPreviewNotice')}</p>
        <details>
          <summary>{t('mission.guided.tokenPreviewTitle')}</summary>
          <p id="token-preview-motion" role="status">
            {t(reducedMotion ? 'mission.guided.tokenPreviewReduced' : 'mission.guided.tokenPreviewEnabled')}
          </p>
          <button className="guided-primary" type="button" aria-describedby="token-preview-motion" onClick={launchConfetti}>
            {t('mission.guided.tokenPreviewLaunch')}
          </button>
          <button className="guided-secondary" style={{ marginTop: '1rem' }} type="button" onClick={() => setReplay((value) => value + 1)}>
            {t('mission.guided.tokenPreviewReplay')}
          </button>
        </details>
      </aside>
    </MissionCompletion>
  );
}
