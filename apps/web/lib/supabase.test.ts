import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseBrowserClient } from './supabase';

describe('supabase browser client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reuses a single browser client instance', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');

    const first = getSupabaseBrowserClient();
    const second = getSupabaseBrowserClient();

    expect(first).toBe(second);
  });
});
