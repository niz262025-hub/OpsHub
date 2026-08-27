import { createClient } from '@supabase/supabase-js';
import { resolveSupabasePublicKey, resolveSupabaseUrl } from './supabase-env';

// Public browser client configuration only. Never import SUPABASE_SERVICE_ROLE_KEY here.
// Supabase currently exposes the browser key as NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// but older projects may still use NEXT_PUBLIC_SUPABASE_ANON_KEY.
export function getSupabaseBrowserClient() {
  const url = resolveSupabaseUrl();
  const publicKey = resolveSupabasePublicKey();

  return createClient(url, publicKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
