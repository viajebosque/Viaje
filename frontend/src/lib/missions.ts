import { supabase } from './supabase';
import { DEFAULT_LANG, type Lang } from '../i18n';

export type Categoria = 'iniciacion' | 'actividad' | 'reflexion';

// Lo que consume la UI: textos ya resueltos al idioma activo.
export type Mission = {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string;
  texto_final: string;
};

// Lo que necesita el mapa para pintar los 9 nodos: el título y nada más.
// La descripción se pide aparte (getMissionDescriptions) porque solo la usa el
// modal, y es el campo pesado: 12 kB entre las 9 misiones contra 220 bytes de
// títulos.
export type MissionSummary = {
  id: string;
  numero: number;
  titulo: string;
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

function pick(row: Row, base: string, lang: Lang): string {
  const candidates = [`${base}_${lang}`, `${base}_${DEFAULT_LANG}`];
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

function toMission(row: Row, lang: Lang): Mission {
  return {
    id: row.id as string,
    numero: row.numero as number,
    titulo: pick(row, 'titulo', lang),
    descripcion: pick(row, 'descripcion', lang),
    texto_final: pick(row, 'texto_final', lang),
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
function langCols(base: string, lang: Lang): string[] {
  return lang === DEFAULT_LANG
    ? [`${base}_${DEFAULT_LANG}`]
    : [`${base}_${lang}`, `${base}_${DEFAULT_LANG}`];
}

// Títulos de las 9 misiones, para el mapa y para la lista de amuletos del
// perfil. Antes esto era select('*'): bajaba las 9 descripciones y los 9 textos
// finales en los dos idiomas (27 kB) para mostrar títulos (220 bytes).
export async function getMissions(lang: Lang): Promise<MissionSummary[]> {
  const { data, error } = (await supabase
    .from('missions')
    .select(['id', 'numero', ...langCols('titulo', lang)].join(', '))
    .order('numero')) as unknown as {
    data: Row[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    numero: row.numero as number,
    titulo: pick(row, 'titulo', lang),
  }));
}

// Descripciones por numero de misión. Va aparte del mapa a propósito: los nodos
// se pintan con los títulos y esto llega detrás, sin frenar el primer dibujo.
// El modal ya tiene fallback (forest.modalAsk) para el instante en que todavía
// no llegó.
export async function getMissionDescriptions(
  lang: Lang
): Promise<Map<number, string>> {
  const { data, error } = (await supabase
    .from('missions')
    .select(['numero', ...langCols('descripcion', lang)].join(', '))) as unknown as {
    data: Row[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  const map = new Map<number, string>();
  for (const row of data ?? []) {
    map.set(row.numero as number, pick(row, 'descripcion', lang));
  }
  return map;
}

// Una misión con sus preguntas, en UNA sola consulta: PostgREST las anida por
// la foreign key questions.mission_id -> missions.id. Antes eran dos viajes
// encadenados, porque no se podían pedir las preguntas sin saber el id.
export async function getMissionWithQuestions(
  numero: number,
  lang: Lang
): Promise<{ mission: Mission; questions: Question[] } | null> {
  const misCols = [
    'id',
    'numero',
    ...langCols('titulo', lang),
    ...langCols('descripcion', lang),
    ...langCols('texto_final', lang),
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
    .select(`${misCols}, questions(${qCols})`)
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

// IDs de misiones que el usuario ya completó (tiene token).
export async function getCompletedMissionIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('mission_tokens')
    .select('mission_id');
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.mission_id));
}

// Bloqueo secuencial: la misión N solo se abre si el usuario ya tiene el token
// de la N-1. Quien manda es la base (SQL/011): RLS esconde las preguntas de una
// misión bloqueada y complete_mission no da el token. Esto es para que la UI
// muestre "Bloqueado" en vez de una pantalla vacía.
//
// Una sola llamada: la RPC resuelve el numero -> mision -> token anterior sin
// que el navegador tenga que leerse la tabla de tokens.
export async function isMissionUnlocked(numero: number): Promise<boolean> {
  if (numero <= 1) return true;
  const { data, error } = await supabase.rpc('mission_unlocked_by_numero', {
    p_numero: numero,
  });
  if (error) throw error;
  return Boolean(data);
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
