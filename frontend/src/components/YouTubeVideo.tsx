import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '../i18n';
import { loadYouTubePlayer } from '../lib/youtubePlayer';

type Props = {
  // Devuelve el ID de YouTube (null = no hay video). Se vuelve a llamar al
  // reintentar, así que un fallo al leer la base también se recupera.
  // Tiene que ser estable (useCallback): cambiarla recarga el video.
  load: () => Promise<string | null>;
  lang: Lang;
  title: string;
  // Marco del video (tamaño, borde, fondo): cada pantalla pone el suyo.
  className: string;
};

// Video de YouTube con aviso de carga y botón de reintentar. Lo usan los tres
// lugares con video: la bienvenida, el paso 2 de cada misión y el cierre del
// viaje. Falla si no hay ID, si la API de YouTube no carga, si el reproductor
// avisa error o si no está listo a los 15 s.
export default function YouTubeVideo({ load, lang, title, className }: Props) {
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

    const fail = () => {
      window.clearTimeout(readyTimeout);
      if (!cancelled) setStatus('error');
    };

    void Promise.all([load(), loadYouTubePlayer()])
      .then(([videoId, api]) => {
        if (cancelled) return;
        if (!videoId) return fail();
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
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
        iframe.title = title;
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        container.appendChild(iframe);
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
      })
      .catch((error: unknown) => {
        console.error(error);
        fail();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
      player?.destroy();
      container.replaceChildren();
    };
  }, [attempt, lang, load, title]);

  return (
    <div className={`youtube-video ${className}`}>
      <div className="youtube-video-player" ref={containerRef} />
      {status === 'loading' && (
        <p className="youtube-video-overlay" role="status">
          {t('video.loading')}
        </p>
      )}
      {status === 'error' && (
        <div className="youtube-video-overlay">
          <p role="alert">{t('video.error')}</p>
          <button
            className="youtube-video-retry"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('video.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
