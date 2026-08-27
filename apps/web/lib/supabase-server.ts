import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolveSupabasePublicKey, resolveSupabaseUrl } from './supabase-env';

// Browser-facing public configuration stays in public env vars.
// Server-only values such as SUPABASE_SERVICE_ROLE_KEY must never be imported into browser or client code.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const publicKey = resolveSupabasePublicKey();

  return createServerClient(resolveSupabaseUrl(), publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}
