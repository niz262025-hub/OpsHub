import { createClient } from '@supabase/supabase-js';

// Public browser client configuration only. Never import SUPABASE_SERVICE_ROLE_KEY here.
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example-project.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key';

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
