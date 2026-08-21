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

// Todas las misiones (para el mapa). Ordenadas por numero.
export async function getMissions(lang: Lang): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .order('numero');
  if (error) throw error;
  return (data ?? []).map((row) => toMission(row, lang));
}

// Una misión por su numero (1..9).
export async function getMissionByNumero(
  numero: number,
  lang: Lang
): Promise<Mission | null> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('numero', numero)
    .maybeSingle();
  if (error) throw error;
  return data ? toMission(data, lang) : null;
}

// Preguntas de una misión, ordenadas.
export async function getQuestions(
  missionId: string,
  lang: Lang
): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('mission_id', missionId)
    .order('orden');
  if (error) throw error;
  return (data ?? []).map((row) => toQuestion(row, lang));
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
