import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resolveSupabasePublicKey, resolveSupabaseUrl } from './lib/supabase-env';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Public visitors do not need an Auth request. Route-level authorization
  // remains responsible for access; this hook only refreshes cookie sessions.
  if (!request.cookies.getAll().some(cookie => cookie.name.startsWith('sb-'))) return response;
  let url: string;
  let key: string;
  try {
    url = resolveSupabaseUrl();
    key = resolveSupabasePublicKey();
  } catch { return response; }
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  // getUser validates with Auth; unverified cookie claims never grant access.
  await client.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
