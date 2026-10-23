import { supabase } from './supabase';
import type { Lang } from '../i18n';
import { langCols, pick } from './missions';
import { youtubeId } from './youtube';

// Los videos de la plataforma viven en la tabla `videos` (SQL/021) y se
// cambian desde /admin. Acá se leen los dos que no son de una misión; el de
// cada misión llega junto con la misión (getMissionWithQuestions).
//
// Quién lee qué lo decide la RLS: la bienvenida es pública (se ve antes del
// login), el cierre pide sesión.
type VideoTipo = 'bienvenida' | 'cierre';

// ID de YouTube del video en el idioma activo (cae al español si el inglés no
// está). null si no hay fila o el link guardado no es válido; un error de red
// se lanza, para que la pantalla ofrezca reintentar.
async function getVideoId(tipo: VideoTipo, lang: Lang): Promise<string | null> {
  const { data, error } = (await supabase
    .from('videos')
    .select(langCols('url', lang).join(', '))
    .eq('tipo', tipo)
    .maybeSingle()) as unknown as {
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return data ? youtubeId(pick(data, 'url', lang)) : null;
}

export function getWelcomeVideoId(lang: Lang): Promise<string | null> {
  return getVideoId('bienvenida', lang);
}

export function getClosingVideoId(lang: Lang): Promise<string | null> {
  return getVideoId('cierre', lang);
}
