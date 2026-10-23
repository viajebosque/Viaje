// Saca el ID de un video de YouTube de cualquiera de sus formatos de link:
//   https://youtube.com/shorts/ID        https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID                  https://www.youtube.com/embed/ID
//   https://www.youtube.com/live/ID      https://www.youtube-nocookie.com/embed/ID
// Devuelve null si no es un link de YouTube con un ID válido.
//
// Misma lógica que frontend/src/lib/youtube.ts: si cambia una, cambia la otra.
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const PATH_PREFIXES = ['shorts', 'embed', 'live', 'v'];

export function youtubeId(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  let id = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = parts[0] ?? null;
  } else if (HOSTS.has(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (PATH_PREFIXES.includes(parts[0])) id = parts[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}
