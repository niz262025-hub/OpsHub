import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('supabase browser client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reuses a single browser client instance when browser config is present', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');

    const { getSupabaseBrowserClient } = await import('./supabase');
    const first = getSupabaseBrowserClient();
    const second = getSupabaseBrowserClient();

    expect(first).toBe(second);
  });

  it('uses the fallback browser config when env values are blank', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');

    const { getSupabaseBrowserClient } = await import('./supabase');

    expect(getSupabaseBrowserClient()).toBeTruthy();
  });
});
