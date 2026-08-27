export function resolveSupabasePublicKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    'public-anon-key'
  );
}

export function resolveSupabaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example-project.supabase.co';
}

export function resolveServerSupabaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example-project.supabase.co';
}

export function resolveServerSupabaseKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key';
}

export function resolveServiceRoleKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function resolveProjectId(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.SUPABASE_PROJECT_ID ?? 'missing';
}
