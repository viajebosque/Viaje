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
  await supabase.from('profiles').update({ email }).eq('id', userId);
}

export type Role = 'admin' | 'usuario';

// Rol del usuario logueado. RLS deja leer SOLO la fila propia, así que esto
// sirve para saber si soy admin, no para mirar a otros.
// Sirve para mostrar/ocultar el panel; el permiso real lo valida el backend.
export async function getProfileRole(userId: string): Promise<Role | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.role === 'admin' || data.role === 'usuario' ? data.role : null;
}

export async function getProfileLang(userId: string): Promise<Lang | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('lang')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return isLang(data.lang) ? data.lang : null;
}

export async function setProfileLang(userId: string, lang: Lang): Promise<void> {
  await supabase.from('profiles').update({ lang }).eq('id', userId);
}
