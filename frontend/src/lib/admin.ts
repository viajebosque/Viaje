import { apiAuthGet, apiAuthPatch } from './api';
import type { Lang } from '../i18n';
import type { Role } from './profile';

// Datos que el panel de admin muestra de cada usuario.
export type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_paid: boolean;
  lang: Lang;
  created_at: string;
};

// Ordenamientos que acepta el backend (lista cerrada).
export const USER_SORTS = [
  'name_asc',
  'name_desc',
  'created_desc',
  'created_asc',
] as const;
export type UserSort = (typeof USER_SORTS)[number];
export const DEFAULT_SORT: UserSort = 'created_desc';

// Tamaño de página: la base devuelve 10 filas por vez, no la tabla entera.
export const PAGE_SIZE = 10;

export type UsersPage = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

// Una página de usuarios, filtrada por nombre/correo y ordenada.
// Todo pasa por el backend: con la anon key el usuario solo ve su propia fila.
export async function listUsers(
  search: string,
  sort: UserSort,
  page: number
): Promise<UsersPage> {
  const params = new URLSearchParams({
    sort,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (search.trim()) params.set('search', search.trim());
  return apiAuthGet<UsersPage>(`/api/admin/users?${params.toString()}`);
}

// Marca a un usuario como pagado o no pagado.
export async function setUserPaid(
  userId: string,
  isPaid: boolean
): Promise<AdminUser> {
  const { user } = await apiAuthPatch<{ user: AdminUser }>(
    `/api/admin/users/${userId}/paid`,
    { is_paid: isPaid }
  );
  return user;
}

// ---------------------------------------------------------------------------
// Gestión de preguntas
//
// También por el backend: con la anon key `questions` es de solo lectura (y
// solo las de misiones desbloqueadas), así que no hay forma de editarlas
// desde el navegador.

export const QUESTION_CATEGORIES = ['iniciacion', 'actividad', 'reflexion'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export type AdminQuestion = {
  id: string;
  categoria: QuestionCategory;
  orden: number;
  enunciado_es: string;
  enunciado_en: string | null;
};

export type AdminMission = {
  id: string;
  numero: number;
  titulo_es: string;
  titulo_en: string | null;
  // Ventana de entrada del mapa: frase principal y recuadro verde (SQL/026).
  frase1_portada_es: string;
  frase1_portada_en: string | null;
  frase2_portada_es: string;
  frase2_portada_en: string | null;
  consecuencia_amable_es: string;
  consecuencia_amable_en: string | null;
  // Vacío = la tarjeta no se muestra (la Misión 9 no tiene siguiente).
  frase_final_es: string;
  frase_final_en: string | null;
  questions: AdminQuestion[];
};

// Lo que devuelve el backend al guardar una misión.
export type AdminMissionTexts = Omit<AdminMission, 'questions'>;

// Las 9 misiones, ordenadas, con sus preguntas ordenadas.
export async function listQuestions(): Promise<AdminMission[]> {
  const { missions } = await apiAuthGet<{ missions: AdminMission[] }>(
    '/api/admin/questions'
  );
  return missions;
}

// Guarda el enunciado en los dos idiomas. El inglés vacío queda NULL
// (el frontend cae al español).
export async function updateQuestion(
  questionId: string,
  enunciadoEs: string,
  enunciadoEn: string
): Promise<AdminQuestion> {
  const { question } = await apiAuthPatch<{ question: AdminQuestion }>(
    `/api/admin/questions/${questionId}`,
    { enunciado_es: enunciadoEs, enunciado_en: enunciadoEn }
  );
  return question;
}

// Textos de `missions` que se ven en pantalla y se editan desde el panel.
export type MissionTextField =
  | 'titulo'
  | 'frase1_portada'
  | 'frase2_portada'
  | 'consecuencia_amable'
  | 'frase_final';

// Guarda uno o más textos de la misión, cada uno en los dos idiomas, en un solo
// request (las dos frases de portada se guardan juntas). El inglés vacío queda
// NULL (el frontend cae al español).
export async function updateMissionTexts(
  missionId: string,
  texts: Partial<Record<MissionTextField, { es: string; en: string }>>
): Promise<AdminMissionTexts> {
  const body: Record<string, string> = {};
  for (const [field, value] of Object.entries(texts)) {
    body[`${field}_es`] = value.es;
    body[`${field}_en`] = value.en;
  }
  const { mission } = await apiAuthPatch<{ mission: AdminMissionTexts }>(
    `/api/admin/missions/${missionId}`,
    body
  );
  return mission;
}

// ---------------------------------------------------------------------------
// Gestión de videos
//
// Los links de YouTube de la plataforma (tabla `videos`, SQL/021). Con la anon
// key la tabla es solo lectura, así que se guarda por el backend.

export type VideoTipo = 'bienvenida' | 'mision' | 'cierre';

export type AdminVideo = {
  id: string;
  tipo: VideoTipo;
  // Número de la misión; null en bienvenida y cierre.
  numero: number | null;
  url_es: string;
  url_en: string | null;
};

// Las 11 filas, en el orden en que aparecen en el viaje: bienvenida, misiones
// 1–9, cierre.
export async function listVideos(): Promise<AdminVideo[]> {
  const { videos } = await apiAuthGet<{ videos: AdminVideo[] }>('/api/admin/videos');
  return videos;
}

// Guarda los dos links. El backend rechaza lo que no sea un link de YouTube;
// el inglés vacío queda NULL (se muestra el video en español).
export async function updateVideo(
  videoId: string,
  urlEs: string,
  urlEn: string
): Promise<AdminVideo> {
  const { video } = await apiAuthPatch<{ video: AdminVideo }>(
    `/api/admin/videos/${videoId}`,
    { url_es: urlEs, url_en: urlEn }
  );
  return video;
}
