import { supabase } from './supabase';
import { DEFAULT_LANG, type Lang } from '../i18n';
import { youtubeId } from './youtube';

export type Categoria = 'iniciacion' | 'actividad' | 'reflexion';

// Lo que consume la UI: textos ya resueltos al idioma activo.
export type Mission = {
  id: string;
  numero: number;
  titulo: string;
  // Tarjeta del panel lateral ("Es importante atravesar esta misión
  // porque…"). Columna consecuencia_amable_es / _en (SQL/022).
  consecuencia: string;
  // Tarjeta del modal "Has completado la Misión N" que adelanta la siguiente.
  // Columna frase_final_es / _en (SQL/024). Vacía = la tarjeta no se muestra.
  fraseFinal: string;
  // ID de YouTube del video del paso 2 (tabla `videos`, SQL/021), en el idioma
  // activo. null = la misión no tiene video y el paso se salta.
  videoId: string | null;
};

// Lo que necesita el mapa para pintar los 9 nodos y su ventana de entrada.
export type MissionSummary = {
  id: string;
  numero: number;
  titulo: string;
  // Frases de la ventana de entrada del mapa (SQL/026). Solo las pide el mapa
  // (getMissions con withPortada); en el resto llegan vacías.
  //   frase1: la frase principal, debajo del título
  //   frase2: la del recuadro verde. En inglés NO cae al español: vacía, el
  //           mapa muestra la genérica forest.modalHint, como antes de que
  //           existiera la columna (ninguna está traducida todavía)
  frase1: string;
  frase2: string;
};

export type Question = {
  id: string;
  mission_id: string;
  categoria: Categoria;
  enunciado: string;
  orden: number;
};

// El contenido traducible vive SOLO en columnas por idioma (titulo_es /
// titulo_en). Elige la del idioma activo; si esa misión aún no está traducida
// cae al español, que es obligatorio en la BD.
type Row = Record<string, unknown>;

export function pick(row: Row, base: string, lang: Lang): string {
  const candidates = [`${base}_${lang}`, `${base}_${DEFAULT_LANG}`];
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

function toMission(row: Row, lang: Lang): Mission {
  // mission_id es único en `videos`, así que PostgREST lo anida como objeto
  // (o null si no hay fila). Se acepta también la forma de lista por las dudas.
  const nested = Array.isArray(row.videos) ? row.videos[0] : row.videos;
  const video = nested && typeof nested === 'object' ? (nested as Row) : null;
  return {
    id: row.id as string,
    numero: row.numero as number,
    titulo: pick(row, 'titulo', lang),
    consecuencia: pick(row, 'consecuencia_amable', lang),
    fraseFinal: pick(row, 'frase_final', lang),
    videoId: video ? youtubeId(pick(video, 'url', lang)) : null,
  };
}

function toQuestion(row: Row, lang: Lang): Question {
  return {
    id: row.id as string,
    mission_id: row.mission_id as string,
    categoria: row.categoria as Categoria,
    enunciado: pick(row, 'enunciado', lang),
    orden: row.orden as number,
  };
}

// Columnas de texto que hay que pedir para un idioma: la del idioma activo más
// la española, que es a la que cae el fallback. En español es una sola.
export function langCols(base: string, lang: Lang): string[] {
  return lang === DEFAULT_LANG
    ? [`${base}_${DEFAULT_LANG}`]
    : [`${base}_${lang}`, `${base}_${DEFAULT_LANG}`];
}

// Títulos de las 9 misiones, para el mapa y para la lista de amuletos del
// perfil. Antes esto era select('*'): bajaba las 9 descripciones y los 9 textos
// finales en los dos idiomas (27 kB) para mostrar títulos (220 bytes).
// withPortada suma las dos frases de la ventana de entrada: solo el mapa las
// usa, el perfil no las baja.
export async function getMissions(
  lang: Lang,
  withPortada = false
): Promise<MissionSummary[]> {
  const cols = ['id', 'numero', ...langCols('titulo', lang)];
  if (withPortada) {
    cols.push(...langCols('frase1_portada', lang), `frase2_portada_${lang}`);
  }
  const { data, error } = (await supabase
    .from('missions')
    .select(cols.join(', '))
    .order('numero')) as unknown as {
    data: Row[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    numero: row.numero as number,
    titulo: pick(row, 'titulo', lang),
    frase1: withPortada ? pick(row, 'frase1_portada', lang) : '',
    frase2: withPortada ? ((row[`frase2_portada_${lang}`] as string | null) ?? '') : '',
  }));
}

// Una misión con sus preguntas y su video, en UNA sola consulta: PostgREST los
// anida por las foreign keys questions.mission_id y videos.mission_id ->
// missions.id. Antes eran dos viajes encadenados, porque no se podían pedir las
// preguntas sin saber el id.
export async function getMissionWithQuestions(
  numero: number,
  lang: Lang
): Promise<{ mission: Mission; questions: Question[] } | null> {
  const misCols = [
    'id',
    'numero',
    ...langCols('titulo', lang),
    ...langCols('consecuencia_amable', lang),
    ...langCols('frase_final', lang),
  ].join(', ');
  const qCols = [
    'id',
    'mission_id',
    'categoria',
    'orden',
    ...langCols('enunciado', lang),
  ].join(', ');

  // El select se arma en tiempo de ejecución (depende del idioma), así que el
  // parser de tipos de PostgREST no puede deducir la forma de la respuesta. Se
  // tipea acá, en el borde, y de ahí para adentro es Row como el resto.
  const { data, error } = (await supabase
    .from('missions')
    .select(`${misCols}, questions(${qCols}), videos(${langCols('url', lang).join(', ')})`)
    .eq('numero', numero)
    .order('orden', { referencedTable: 'questions' })
    .maybeSingle()) as unknown as {
    data: Row | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  if (!data) return null;

  const rows = Array.isArray(data.questions) ? (data.questions as Row[]) : [];
  return {
    mission: toMission(data, lang),
    questions: rows.map((q) => toQuestion(q, lang)),
  };
}

// Respuestas del usuario para un conjunto de preguntas.
// Devuelve un mapa { question_id: respuesta }.
// Las respuestas NO se traducen: son texto del usuario, se guardan tal cual.
export async function getAnswers(
  questionIds: string[]
): Promise<Record<string, string>> {
  if (questionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('answers')
    .select('question_id, respuesta')
    .in('question_id', questionIds);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.question_id] = row.respuesta ?? '';
  return map;
}

// Guarda (crea o actualiza) un bloque de respuestas del usuario.
export async function saveAnswers(
  userId: string,
  entries: { question_id: string; respuesta: string }[]
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    user_id: userId,
    question_id: e.question_id,
    respuesta: e.respuesta,
  }));
  const { error } = await supabase
    .from('answers')
    .upsert(rows, { onConflict: 'user_id,question_id' });
  if (error) throw error;
}

// Reclama el token de la misión. La función de la BD valida que TODO
// esté respondido; devuelve true si el token quedó otorgado.
export async function completeMission(missionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('complete_mission', {
    p_mission_id: missionId,
  });
  if (error) throw error;
  return Boolean(data);
}

// Cuántas misiones tiene el viaje. La última es la que cierra el recorrido:
// su botón final lleva al mapa con el aviso de viaje completado.
export const TOTAL_MISSIONS = 9;

// Estado de navegación con el que la última misión vuelve al mapa. El mapa
// igual confirma con los tokens antes de mostrar el cierre del viaje.
export type ForestLocationState = { journeyComplete?: boolean };

// Reinicia el viaje: borra TODAS las respuestas y tokens de la persona. Lo hace
// la función de la BD (SQL/018), que solo lo permite con las 9 misiones
// completadas y nunca toca is_paid. Devuelve false si no se pudo reiniciar.
export async function resetJourney(): Promise<boolean> {
  const { data, error } = await supabase.rpc('reset_journey');
  if (error) throw error;
  return Boolean(data);
}

// IDs de misiones que el usuario ya completó (tiene token).
export async function getCompletedMissionIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('mission_tokens')
    .select('mission_id');
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.mission_id));
}

// Por qué una misión está abierta o cerrada.
//   open    -> puede entrar
//   locked  -> le falta el token de la misión anterior
//   paywall -> es de pago y todavía no pagó
//   missing -> ese número de misión no existe
export type MissionAccess = 'open' | 'locked' | 'paywall' | 'missing';

// Hasta qué misión se llega sin pagar. Es un espejo de free_mission_limit() en
// la base (SQL/012), que es la que manda de verdad: esta constante solo sirve
// para pintar el mapa sin preguntar 9 veces. Si cambia una, cambia la otra.
export const FREE_MISSIONS = 2;

// Dos reglas encimadas: orden (token de la N-1) y pago. Quien manda es la base
// (SQL/011 + SQL/012): la RLS esconde las preguntas y complete_mission no da el
// token. Esto es para que la UI muestre el mensaje correcto en vez de una
// pantalla vacía.
//
// Una sola llamada: la RPC resuelve número -> misión -> token anterior -> pago.
export async function getMissionAccess(numero: number): Promise<MissionAccess> {
  const { data, error } = await supabase.rpc('mission_access_by_numero', {
    p_numero: numero,
  });
  if (error) throw error;
  return (data as MissionAccess) ?? 'missing';
}

// Consulta puntual para reflejar si una misión ya fue completada. La
// restricción única de mission_tokens y la RPC mantienen el premio idempotente.
export async function hasMissionToken(missionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('mission_tokens')
    .select('mission_id')
    .eq('mission_id', missionId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
