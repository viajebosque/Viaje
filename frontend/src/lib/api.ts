import { supabase } from './supabase';

// URL base del backend (Railway). Ej: https://viaje-dev.up.railway.app
const API_URL = import.meta.env.VITE_API_URL;

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// Endpoints que exigen sesión: se manda el access_token de Supabase y el backend
// lo valida (y de ahí saca el rol). Ver backend/src/middleware/requireAdmin.js.
async function authFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay sesión activa');

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!res.ok) {
    // El backend responde { error: "..." }; si no, se usa el status.
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function apiAuthGet<T>(path: string): Promise<T> {
  return authFetch<T>(path);
}

export function apiAuthPatch<T>(path: string, body: unknown): Promise<T> {
  return authFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}
