import { createBrowserClient } from '@supabase/ssr';
import { resolveSupabasePublicKey, resolveSupabaseUrl } from './supabase-env';

// Public browser client configuration only. Never import SUPABASE_SERVICE_ROLE_KEY here.
// Supabase currently exposes the browser key as NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// but older projects may still use NEXT_PUBLIC_SUPABASE_ANON_KEY.
export function getSupabaseBrowserClient() {
  const url = resolveSupabaseUrl();
  const publicKey = resolveSupabasePublicKey();

  // Share cookie storage with server-rendered admin pages and export routes.
  return createBrowserClient(url, publicKey);
}
