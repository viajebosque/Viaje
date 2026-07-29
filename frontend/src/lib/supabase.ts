import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Permite renderizar la interfaz en desarrollo aunque todavía no exista un
// .env local. Las operaciones de autenticación solo funcionarán al configurar
// las credenciales reales indicadas en .env.example.
const previewUrl = 'http://127.0.0.1:54321';
const previewAnonKey = 'preview-anon-key';

// Cliente de navegador: usa la anon key (segura para exponer).
export const supabase = createClient(
  url || previewUrl,
  anonKey || previewAnonKey
);
