import { createHash } from 'node:crypto';
import { supabase } from '../supabase.js';

// Puerta de entrada de /api/admin.
//
// El frontend manda el access_token de Supabase en:
//   Authorization: Bearer <token>
//
// Acá se verifican DOS cosas:
//   1. Que el token sea válido (supabase.auth.getUser valida la firma).
//   2. Que ese usuario tenga role = 'admin' en profiles.
//
// El rol se lee de la base con la service_role key, NO del token: el JWT lo
// tiene el navegador y no queremos que el permiso dependa de algo que el
// cliente manda.
//
// ---------------------------------------------------------------------------
// POR QUÉ ESTE ARCHIVO SE PREOCUPA POR LA VELOCIDAD
//
// Cada request al panel encadenaba TRES viajes a Supabase, uno detrás de otro:
//   getUser(token)  ~600 ms
//   leer role       ~550 ms
//   la consulta     ~520 ms      → ~1,7 s de piso, medido en los logs de prod
//
// Dos cambios los recortan sin aflojar la verificación:
//
//   a) El rol se pide EN PARALELO con getUser. El `sub` del JWT se lee sin
//      verificar (solo para saber qué fila precargar); lo que autoriza sigue
//      siendo getUser. Si el token fuera falso, getUser falla y la precarga se
//      tira a la basura. Ahorra un viaje.
//
//   b) El resultado positivo se guarda en memoria un minuto, por token. El
//      panel dispara varias requests seguidas (paginar, buscar, marcar
//      pagado) y todas repetían la misma verificación.
//
// Solo se cachea el "sí". El "no" se vuelve a preguntar siempre: si alguien
// acaba de recibir el rol, no tiene que esperar a que venza nada. Al revés,
// quitarle el rol a alguien puede tardar hasta un minuto en hacer efecto —
// aceptable, porque `role` solo se cambia por SQL (ver SQL/008).
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;

// Clave: hash del token, no el token. Si el proceso vuelca su memoria a un log,
// no queda una credencial usable dando vueltas.
const adminCache = new Map();

function cacheKey(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cacheGet(key) {
  const hit = adminCache.get(key);
  if (!hit) return null;
  if (hit.until < Date.now()) {
    adminCache.delete(key);
    return null;
  }
  return hit.admin;
}

function cacheSet(key, admin) {
  if (adminCache.size >= CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of adminCache) if (v.until < now) adminCache.delete(k);
    // Si igual sigue lleno (muchos tokens vivos), se descarta el más viejo.
    if (adminCache.size >= CACHE_MAX_ENTRIES) {
      adminCache.delete(adminCache.keys().next().value);
    }
  }
  adminCache.set(key, { admin, until: Date.now() + CACHE_TTL_MS });
}

// Lee el `sub` del JWT SIN verificar la firma. Sirve nada más para adelantar la
// consulta del rol; nunca para decidir si alguien pasa.
function unverifiedSubject(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims?.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

function readRole(userId) {
  return supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
}

export async function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }

  const key = cacheKey(token);
  const cached = cacheGet(key);
  if (cached) {
    req.admin = cached;
    return next();
  }

  try {
    // Se lanzan las dos juntas. `guess` es el usuario que dice el token; si el
    // token no fuera válido, getUser falla y esa lectura no se usa.
    const guess = unverifiedSubject(token);
    const [{ data: auth, error: authError }, prefetched] = await Promise.all([
      supabase.auth.getUser(token),
      guess ? readRole(guess) : Promise.resolve(null),
    ]);

    if (authError || !auth?.user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    // La precarga sirve solo si apuntaba al usuario que el token resultó ser.
    const lookup =
      prefetched && guess === auth.user.id ? prefetched : await readRole(auth.user.id);

    if (lookup.error) {
      return res.status(500).json({ error: lookup.error.message });
    }
    if (lookup.data?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores' });
    }

    const admin = { id: auth.user.id, email: auth.user.email };
    cacheSet(key, admin);
    req.admin = admin;
    next();
  } catch (e) {
    // Si Supabase no responde, se niega el paso. Nunca se deja pasar por error.
    console.error('[requireAdmin]', e);
    res.status(503).json({ error: 'No se pudo verificar la sesión' });
  }
}
