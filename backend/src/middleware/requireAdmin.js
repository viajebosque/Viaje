import { supabase } from '../supabase.js';

// Puerta de entrada de /api/admin.
//
// El frontend manda el access_token de Supabase en:
//   Authorization: Bearer <token>
//
// Acá se verifican DOS cosas, en este orden:
//   1. Que el token sea válido (supabase.auth.getUser valida la firma).
//   2. Que ese usuario tenga role = 'admin' en profiles.
//
// El rol se lee de la base con la service_role key, NO del token: el JWT lo
// tiene el navegador y no queremos que el permiso dependa de algo que el
// cliente manda.
export async function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }

  try {
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth?.user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }
    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores' });
    }

    req.admin = { id: auth.user.id, email: auth.user.email };
    next();
  } catch (e) {
    // Si Supabase no responde, se niega el paso. Nunca se deja pasar por error.
    console.error('[requireAdmin]', e);
    res.status(503).json({ error: 'No se pudo verificar la sesión' });
  }
}
