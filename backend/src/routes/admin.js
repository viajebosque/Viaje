import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

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
