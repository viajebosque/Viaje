type YouTubePlayer = { destroy: () => void };

type PlayerOptions = {
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onError: () => void;
  };
};

type YouTubeAPI = {
  Player: new (element: HTMLIFrameElement, options: PlayerOptions) => YouTubePlayer;
  PlayerState: { ENDED: number };
};

const youtubeWindow = window as Window & {
  YT?: YouTubeAPI;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YouTubeAPI> | null = null;

// Share the official API between mounts, including React StrictMode's setup/cleanup cycle.
export function loadYouTubePlayer(): Promise<YouTubeAPI> {
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onerror = null;
      if (youtubeWindow.onYouTubeIframeAPIReady === ready) {
        youtubeWindow.onYouTubeIframeAPIReady = previousReady;
      }
    };
    const fail = () => {
      cleanup();
      script.remove();
      apiPromise = null;
      reject(new Error('YouTube player could not load'));
    };
    const ready = () => {
      if (!youtubeWindow.YT?.Player) {
        fail();
        return;
      }
      cleanup();
      resolve(youtubeWindow.YT);
      previousReady?.();
    };
    const timeout = window.setTimeout(fail, 15000);
    youtubeWindow.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return apiPromise;
}
