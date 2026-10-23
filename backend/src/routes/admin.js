import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { youtubeId } from '../youtube.js';

// Rutas del panel de administración. Todas exigen role='admin'.
//
// Esto vive en el backend y no en el frontend por dos razones de la base:
//   - RLS: con la anon key el usuario solo ve SU fila de profiles, no la de los demás.
//   - El trigger profiles_guard_privileged (SQL/005) ignora los cambios de
//     `is_paid` que vienen del navegador. Con la service_role key sí pasan.
export const adminRouter = Router();

adminRouter.use(requireAdmin);

// Ordenamientos permitidos. Lista cerrada: la clave viene del cliente, la
// columna no.
const SORTS = {
  name_asc: { column: 'full_name', ascending: true },
  name_desc: { column: 'full_name', ascending: false },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
};
const DEFAULT_SORT = 'created_desc';

// Paginado: la base devuelve solo la página pedida, no la tabla entera.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function positiveInt(raw, fallback, max) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

// El texto de búsqueda se inserta en un filtro `or` de PostgREST, donde la coma,
// los paréntesis y el asterisco son sintaxis. Se limpian para que una búsqueda
// no pueda romper (ni cambiar) el query.
function cleanSearch(raw) {
  return String(raw ?? '')
    .replace(/[,()"'\\*%]/g, ' ')
    .trim()
    .slice(0, 80);
}

// Express 4 no atrapa las promesas rechazadas: sin esto, un fallo de red deja
// el request colgado hasta el timeout.
function handle(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error('[admin]', e);
      if (!res.headersSent) {
        res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
      }
    });
  };
}

// GET /api/admin/users?search=texto&sort=name_asc&page=1&pageSize=10
// Devuelve UNA página de perfiles, filtrada y ordenada, más el total para
// poder armar el paginador.
adminRouter.get('/users', handle(async (req, res) => {
  const sort = SORTS[req.query.sort] ?? SORTS[DEFAULT_SORT];
  const search = cleanSearch(req.query.search);
  const page = positiveInt(req.query.page, 1);
  const pageSize = positiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;

  // count: 'exact' devuelve cuántas filas hay en total con ese filtro, sin
  // traerlas. range() hace que la base mande solo esta página.
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, is_paid, lang, created_at', {
      count: 'exact',
    })
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    // Desempate estable: sin esto, dos filas con el mismo nombre (o la misma
    // fecha) pueden cambiar de orden entre páginas y una se ve dos veces.
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1);

  if (search) {
    query = query.or(`full_name.ilike.*${search}*,email.ilike.*${search}*`);
  }

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    users: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}));

// PATCH /api/admin/users/:id/paid   body: { is_paid: true | false }
// Marca a un usuario como pagado o no pagado.
adminRouter.patch('/users/:id/paid', handle(async (req, res) => {
  const { is_paid } = req.body ?? {};
  if (typeof is_paid !== 'boolean') {
    return res.status(400).json({ error: 'is_paid debe ser true o false' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_paid })
    .eq('id', req.params.id)
    .select('id, full_name, email, role, is_paid, lang, created_at')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });

  console.log(
    `[admin] ${req.admin.email} puso is_paid=${is_paid} en ${data.email ?? data.id}`
  );
  res.json({ user: data });
}));

// ---------------------------------------------------------------------------
// Gestión de preguntas
//
// Va por el backend porque con la anon key `questions` es solo lectura (y
// encima solo de las misiones desbloqueadas): no hay policy de UPDATE.

// Tope de largo por enunciado. El más largo cargado hoy ronda los 700
// caracteres; esto solo evita que un pegado accidental llene la fila.
const MAX_ENUNCIADO = 6000;

// GET /api/admin/questions
// Las 9 misiones, en orden, cada una con sus preguntas ordenadas.
adminRouter.get('/questions', handle(async (req, res) => {
  const { data, error } = await supabase
    .from('missions')
    .select(
      'id, numero, titulo_es, titulo_en, questions(id, categoria, orden, enunciado_es, enunciado_en)'
    )
    .order('numero', { ascending: true })
    .order('orden', { referencedTable: 'questions', ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ missions: data ?? [] });
}));

// PATCH /api/admin/questions/:id   body: { enunciado_es, enunciado_en }
// El español es obligatorio (es el idioma al que cae el fallback). El inglés
// vacío se guarda como NULL: así el frontend muestra el español en vez de un
// texto en blanco.
adminRouter.patch('/questions/:id', handle(async (req, res) => {
  const { enunciado_es, enunciado_en } = req.body ?? {};

  if (typeof enunciado_es !== 'string' || !enunciado_es.trim()) {
    return res.status(400).json({ error: 'enunciado_es es obligatorio' });
  }
  if (enunciado_en != null && typeof enunciado_en !== 'string') {
    return res.status(400).json({ error: 'enunciado_en debe ser texto o null' });
  }
  const es = enunciado_es.trim();
  const en = enunciado_en?.trim() || null;
  if (es.length > MAX_ENUNCIADO || (en?.length ?? 0) > MAX_ENUNCIADO) {
    return res.status(400).json({ error: `Máximo ${MAX_ENUNCIADO} caracteres` });
  }

  const { data, error } = await supabase
    .from('questions')
    .update({ enunciado_es: es, enunciado_en: en })
    .eq('id', req.params.id)
    .select('id, categoria, orden, enunciado_es, enunciado_en')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Pregunta no encontrada' });

  console.log(`[admin] ${req.admin.email} editó la pregunta ${data.id}`);
  res.json({ question: data });
}));

// Tope del título. Hoy el más largo tiene 26 caracteres.
const MAX_TITULO = 120;

// PATCH /api/admin/missions/:id   body: { titulo_es, titulo_en }
// Solo el título: es el único texto de `missions` que hoy se ve en pantalla
// (la descripción del modal del mapa sale de es/en.json, y texto_final no se
// muestra). Misma regla que las preguntas: español obligatorio, inglés vacío
// = NULL.
adminRouter.patch('/missions/:id', handle(async (req, res) => {
  const { titulo_es, titulo_en } = req.body ?? {};

  if (typeof titulo_es !== 'string' || !titulo_es.trim()) {
    return res.status(400).json({ error: 'titulo_es es obligatorio' });
  }
  if (titulo_en != null && typeof titulo_en !== 'string') {
    return res.status(400).json({ error: 'titulo_en debe ser texto o null' });
  }
  const es = titulo_es.trim();
  const en = titulo_en?.trim() || null;
  if (es.length > MAX_TITULO || (en?.length ?? 0) > MAX_TITULO) {
    return res.status(400).json({ error: `Máximo ${MAX_TITULO} caracteres` });
  }

  const { data, error } = await supabase
    .from('missions')
    .update({ titulo_es: es, titulo_en: en })
    .eq('id', req.params.id)
    .select('id, numero, titulo_es, titulo_en')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Misión no encontrada' });

  console.log(`[admin] ${req.admin.email} editó el título de la misión ${data.numero}`);
  res.json({ mission: data });
}));

// ---------------------------------------------------------------------------
// Gestión de videos
//
// Los links de YouTube de la plataforma (SQL/021): bienvenida, el paso 2 de
// cada misión y el cierre del viaje. Con la anon key `videos` es solo lectura.

const VIDEO_COLUMNS = 'id, tipo, mission_id, url_es, url_en, updated_at, missions(numero)';

// Orden del panel: bienvenida, misiones 1–9, cierre.
const TIPO_ORDER = { bienvenida: 0, mision: 1, cierre: 2 };

function toVideo(row) {
  const { missions, ...rest } = row;
  return { ...rest, numero: missions?.numero ?? null };
}

// GET /api/admin/videos
adminRouter.get('/videos', handle(async (req, res) => {
  const { data, error } = await supabase.from('videos').select(VIDEO_COLUMNS);
  if (error) return res.status(500).json({ error: error.message });

  const videos = (data ?? [])
    .map(toVideo)
    .sort(
      (a, b) =>
        TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo] || (a.numero ?? 0) - (b.numero ?? 0)
    );
  res.json({ videos });
}));

// PATCH /api/admin/videos/:id   body: { url_es, url_en }
// Acepta cualquier link de YouTube (shorts/, watch?v=, youtu.be/…) y lo guarda
// tal cual se pegó. Español obligatorio; inglés vacío = NULL (se muestra el
// español). Un link que no es de YouTube no se guarda.
adminRouter.patch('/videos/:id', handle(async (req, res) => {
  const { url_es, url_en } = req.body ?? {};

  if (typeof url_es !== 'string' || !url_es.trim()) {
    return res.status(400).json({ error: 'url_es es obligatorio' });
  }
  if (url_en != null && typeof url_en !== 'string') {
    return res.status(400).json({ error: 'url_en debe ser texto o null' });
  }
  const es = url_es.trim();
  const en = url_en?.trim() || null;
  if (!youtubeId(es)) {
    return res.status(400).json({ error: 'url_es no es un link de YouTube válido' });
  }
  if (en && !youtubeId(en)) {
    return res.status(400).json({ error: 'url_en no es un link de YouTube válido' });
  }

  const { data, error } = await supabase
    .from('videos')
    .update({ url_es: es, url_en: en })
    .eq('id', req.params.id)
    .select(VIDEO_COLUMNS)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Video no encontrado' });

  const video = toVideo(data);
  console.log(
    `[admin] ${req.admin.email} cambió el video ${video.tipo}${video.numero ? ` ${video.numero}` : ''}`
  );
  res.json({ video });
}));
