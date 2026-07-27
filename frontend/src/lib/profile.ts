import { supabase } from './supabase';
import { isLang, type Lang } from '../i18n';

// Preferencia de idioma guardada en el perfil del usuario.
// Sirve para que el idioma lo siga a cualquier dispositivo (localStorage solo
// cubre el mismo navegador).
//
// Ambas funciones son tolerantes a fallos a propósito: el idioma nunca debe
// romper la app. Si la lectura/escritura falla se sigue con el de localStorage.

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
