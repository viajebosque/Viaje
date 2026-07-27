import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan variables: VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY'
  );
}

// Cliente de navegador: usa la anon key (segura para exponer).
export const supabase = createClient(url, anonKey);
