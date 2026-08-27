import { supabase } from './supabase';
import { isLang, type Lang } from '../i18n';

// Preferencia de idioma guardada en el perfil del usuario.
// Sirve para que el idioma lo siga a cualquier dispositivo (localStorage solo
// cubre el mismo navegador).
//
// Ambas funciones son tolerantes a fallos a propósito: el idioma nunca debe
// romper la app. Si la lectura/escritura falla se sigue con el de localStorage.

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_paid: boolean;
  lang: Lang;
  created_at: string;
};

// Perfil del usuario logueado. RLS solo deja leer la fila propia.
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_paid, lang, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

// Nombre visible. Es lo único de identidad que el usuario edita directo en la
// tabla: el trigger del SQL/005 protege role e is_paid, y el correo lo maneja
// Supabase Auth (necesita confirmación).
export async function updateFullName(
  userId: string,
  fullName: string
): Promise<void> {
  forgetProfile();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId);
  if (error) throw error;
}

// La tabla profiles guarda una copia del correo (la puso el trigger al
// registrarse). Cuando la persona confirma un cambio de correo, Auth queda
// actualizado y esta copia no: esto la vuelve a igualar.
export async function syncProfileEmail(
  userId: string,
  email: string
): Promise<void> {
  forgetProfile();
  await supabase.from('profiles').update({ email }).eq('id', userId);
}

export type Role = 'admin' | 'usuario';

// ---------------------------------------------------------------------------
// Caché de la fila propia de profiles
//
// Varios componentes piden el perfil a la vez y todos quieren la MISMA fila:
// LangToggle (que está en App.tsx, o sea en todas las pantallas) y la pantalla
// activa preguntan por `lang`; Forest y AdminRoute preguntan por `role`. Sin
// esto, abrir /forest disparaba tres selects idénticos contra profiles.
//
// Se guarda la promesa, no el resultado: si tres componentes preguntan en el
// mismo tick, los tres esperan la misma request. Si la lectura falla o no
// devuelve fila, se descarta, para que un error pasajero no quede pegado toda
// la sesión.
// ---------------------------------------------------------------------------
let cache: { userId: string; promise: Promise<Profile | null> } | null = null;

function cachedProfile(userId: string): Promise<Profile | null> {
  if (cache && cache.userId === userId) return cache.promise;
  const promise = getMyProfile(userId).then((p) => {
    if (!p && cache?.promise === promise) cache = null;
    return p;
  });
  cache = { userId, promise };
  return promise;
}

// Llamarla cuando el perfil cacheado deja de ser el bueno: al cerrar sesión y
// después de escribir sobre la fila.
export function forgetProfile(): void {
  cache = null;
}

// Rol del usuario logueado. RLS deja leer SOLO la fila propia, así que esto
// sirve para saber si soy admin, no para mirar a otros.
// Sirve para mostrar/ocultar el panel; el permiso real lo valida el backend.
export async function getProfileRole(userId: string): Promise<Role | null> {
  const p = await cachedProfile(userId);
  if (!p) return null;
  return p.role === 'admin' || p.role === 'usuario' ? p.role : null;
}

// ¿El usuario pagó? Sale de la misma fila cacheada que el rol y el idioma, así
// que no cuesta una consulta extra. Solo sirve para pintar el mapa: el muro de
// pago de verdad lo aplica la base (SQL/012).
//
// OJO: si un admin marca a alguien como pagado mientras esa persona tiene la
// sesión abierta, la caché sigue con el valor viejo hasta que recargue.
export async function getProfileIsPaid(userId: string): Promise<boolean> {
  const p = await cachedProfile(userId);
  return p?.is_paid === true;
}

export async function getProfileLang(userId: string): Promise<Lang | null> {
  const p = await cachedProfile(userId);
  if (!p) return null;
  return isLang(p.lang) ? p.lang : null;
}

export async function setProfileLang(userId: string, lang: Lang): Promise<void> {
  forgetProfile();
  await supabase.from('profiles').update({ lang }).eq('id', userId);
}
