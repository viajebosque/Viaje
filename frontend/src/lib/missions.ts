import { supabase } from './supabase';

export type Categoria = 'iniciacion' | 'actividad' | 'reflexion';

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

// Todas las misiones (para el mapa). Ordenadas por numero.
export async function getMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .order('numero');
  if (error) throw error;
  return data ?? [];
}

// Una misión por su numero (1..9).
export async function getMissionByNumero(
  numero: number
): Promise<Mission | null> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('numero', numero)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Preguntas de una misión, ordenadas.
export async function getQuestions(missionId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('mission_id', missionId)
    .order('orden');
  if (error) throw error;
  return data ?? [];
}

// Respuestas del usuario para un conjunto de preguntas.
// Devuelve un mapa { question_id: respuesta }.
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
