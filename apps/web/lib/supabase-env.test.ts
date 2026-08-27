import { describe, expect, it } from 'vitest';
import {
  resolveProjectId,
  resolveServerSupabaseKey,
  resolveServerSupabaseUrl,
  resolveSupabasePublicKey,
  resolveSupabaseUrl,
} from './supabase-env';

describe('Supabase environment resolution', () => {
  it('prefers the current publishable key name for browser clients', () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://staging.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-key',
    };

    expect(resolveSupabaseUrl(env)).toBe('https://staging.supabase.co');
    expect(resolveSupabasePublicKey(env)).toBe('publishable-key');
  });

  it('keeps the server-side config aligned with the current env model', () => {
    const env = {
      SUPABASE_URL: 'https://staging.supabase.co',
      SUPABASE_ANON_KEY: 'server-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_PROJECT_ID: 'abcd1234',
    };

    expect(resolveServerSupabaseUrl(env)).toBe('https://staging.supabase.co');
    expect(resolveServerSupabaseKey(env)).toBe('server-anon-key');
    expect(resolveProjectId(env)).toBe('abcd1234');
  });
});
