import { supabase } from '../lib/supabase';

// Crear cuenta con nombre, correo y contraseña.
// El nombre se guarda en user_metadata.full_name -> el trigger de la BD
// lo copia a la tabla profiles.
export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

// Iniciar sesión con correo y contraseña.
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Iniciar sesión con Google (OAuth). Redirige a Google y vuelve a /forest.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/forest` },
  });
  if (error) throw error;
}
