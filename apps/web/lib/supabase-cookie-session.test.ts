import { afterEach, expect, it, vi } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseBrowserClient } from './supabase';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('carries browser sign-in into server requests and clears it on logout', async () => {
  const jar = new Map<string, string>();
  const document = {
    visibilityState: 'visible',
    addEventListener() {}, removeEventListener() {},
    get cookie() { return [...jar].map(([name,value]) => `${name}=${value}`).join('; '); },
    set cookie(value: string) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0,separator);
      if (/max-age=0/i.test(value)) jar.delete(name);
      else jar.set(name,pair.slice(separator+1));
    },
  };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { document, location: { href:'https://hub.example/auth/login' }, addEventListener() {}, removeEventListener() {} });
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://hub-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
  const user = {id:'10000000-0000-4000-8000-000000000001',email:'test@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})}.test-signature`;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/token')) return new Response(JSON.stringify({access_token:token,refresh_token:'refresh-test',expires_in:3600,token_type:'bearer',user}), {headers:{'Content-Type':'application/json'}});
    if (url.endsWith('/user')) {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
      return new Response(JSON.stringify(user), {headers:{'Content-Type':'application/json'}});
    }
    if (url.includes('/logout')) return new Response('{}', {headers:{'Content-Type':'application/json'}});
    throw new Error(`Unexpected test request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const browser = getSupabaseBrowserClient();
  try {
    const signedIn = await browser.auth.signInWithPassword({email:user.email,password:'test-only-password'});
    expect(signedIn.error).toBeNull();
    expect([...jar.keys()].some(name => name.startsWith('sb-hub-test-auth-token'))).toBe(true);
    const server = createServerClient('https://hub-test.supabase.co','public-test-key', {
      cookies:{getAll:() => [...jar].map(([name,value]) => ({name,value})),setAll() {}},
      global:{fetch:fetchMock},
    });
    expect((await server.auth.getUser()).data.user?.id).toBe(user.id);
    expect((await browser.auth.signOut()).error).toBeNull();
    expect([...jar.keys()].filter(name => name.startsWith('sb-hub-test-auth-token'))).toHaveLength(0);
  } finally { browser.auth.stopAutoRefresh(); }
});
