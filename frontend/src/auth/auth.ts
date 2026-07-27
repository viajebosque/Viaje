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

// Cambiar el correo de la cuenta.
// Supabase manda un correo de confirmación: el cambio recién se aplica cuando
// la persona lo confirma. Hasta entonces sigue entrando con el correo viejo.
export async function changeEmail(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

// Cambiar la contraseña.
//
// Supabase permite cambiarla con solo tener sesión, pero acá se pide también la
// actual y se verifica antes: si alguien deja la sesión abierta en un
// dispositivo ajeno, no debería poder quedarse con la cuenta.
export async function changePassword(
  currentPassword: string,
  newPassword: string
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user.email;
  if (!email) throw new Error('No hay sesión activa');

  const { error: checkError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (checkError) throw new Error('CURRENT_PASSWORD_WRONG');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Iniciar sesión con Google (OAuth). Redirige a Google y vuelve a /forest.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/forest` },
  });
  if (error) throw error;
}
