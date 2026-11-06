import { createClient } from '@supabase/supabase-js';

// Только публичный ключ. service_role во фронтенде не используется.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
