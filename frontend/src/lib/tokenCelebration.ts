import type confetti from 'canvas-confetti';

const GOLD_COLORS = ['#D4A329', '#F4C95D', '#FFE599', '#FFF4CC', '#B8860B'];

// El disparo solo se considera consumido cuando se ejecuta en pantalla.
export function watchTokenCelebration(
  reward: HTMLDivElement,
  tokenImage: HTMLImageElement,
  createConfetti: typeof confetti.create
): () => void {
  let cancelled = false;
  let imageReady = false;
  let visible = false;
  let revealed = false;
  let fired = false;
  let canvas: HTMLCanvasElement | undefined;
  let celebration: ReturnType<typeof confetti.create> | undefined;
  let burstTimer: number | undefined;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const isOnScreen = () => {
    const rect = reward.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
      rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  };

  const cancelBurst = () => {
    window.clearTimeout(burstTimer);
    burstTimer = undefined;
  };

  const ready = () => !cancelled && imageReady && visible &&
    document.visibilityState === 'visible' && isOnScreen();

  const startAnimation = () => {
    if (!ready()) {
      cancelBurst();
      return;
    }
    if (!revealed) {
      revealed = true;
      reward.classList.remove('mission-token-reveal--pending', 'mission-token-reveal--animate');
      void reward.offsetWidth;
      reward.classList.add('mission-token-reveal--animate');
    }
    if (motion.matches) {
      cancelBurst();
      return;
    }
    if (fired || burstTimer !== undefined) return;

    burstTimer = window.setTimeout(() => {
      burstTimer = undefined;
      if (!ready() || motion.matches) return;

      // Fuera de la tarjeta para que los bordes y el scroll no recorten las partículas.
      canvas = document.createElement('canvas');
      canvas.className = 'mission-token-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      celebration = createConfetti(canvas, { resize: true, disableForReducedMotion: true });
      void celebration({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: GOLD_COLORS });
      fired = true;
    }, 420);
  };

  const onImageReady = () => {
    if (cancelled) return;
    imageReady = true;
    startAnimation();
  };

  if (tokenImage.complete) {
    if (typeof tokenImage.decode === 'function') {
      void tokenImage.decode().catch(() => undefined).then(onImageReady);
    } else {
      onImageReady();
    }
  } else {
    tokenImage.addEventListener('load', onImageReady, { once: true });
    tokenImage.addEventListener('error', onImageReady, { once: true });
  }

  let observer: IntersectionObserver | undefined;
  const checkViewport = () => {
    visible = isOnScreen();
    startAnimation();
  };
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      visible = entry.isIntersecting;
      startAnimation();
    }, { threshold: 0 });
    observer.observe(reward);
  } else {
    checkViewport();
    window.addEventListener('scroll', checkViewport, true);
    window.addEventListener('resize', checkViewport);
  }
  document.addEventListener('visibilitychange', startAnimation);
  motion.addEventListener('change', startAnimation);

  return () => {
    cancelled = true;
    cancelBurst();
    celebration?.reset();
    canvas?.remove();
    observer?.disconnect();
    document.removeEventListener('visibilitychange', startAnimation);
    motion.removeEventListener('change', startAnimation);
    window.removeEventListener('scroll', checkViewport, true);
    window.removeEventListener('resize', checkViewport);
    tokenImage.removeEventListener('load', onImageReady);
    tokenImage.removeEventListener('error', onImageReady);
  };
}
