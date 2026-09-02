function getNonEmptyString(env: Partial<NodeJS.ProcessEnv>, keys: string[]) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
}

export function resolveSupabasePublicKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = getNonEmptyString(env, ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);

  if (!value) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The browser runtime must be configured with the staging Supabase public key.');
  }

  return value;
}

export function resolveSupabaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = getNonEmptyString(env, ['NEXT_PUBLIC_SUPABASE_URL']);

  if (!value) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. The browser runtime must be configured with the staging Supabase URL.');
  }

  return value;
}

export function resolveServerSupabaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = getNonEmptyString(env, ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);

  if (!value) {
    throw new Error('Missing SUPABASE_URL. The server runtime must be configured with the staging Supabase URL.');
  }

  return value;
}

export function resolveServerSupabaseKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = getNonEmptyString(env, [
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]);

  if (!value) {
    throw new Error('Missing SUPABASE_ANON_KEY. The server runtime must be configured with the staging Supabase anon key.');
  }

  return value;
}

export function resolveServiceRoleKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function resolveProjectId(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const value = env.SUPABASE_PROJECT_ID ?? process.env.SUPABASE_PROJECT_ID;

  if (!value) {
    throw new Error('Missing SUPABASE_PROJECT_ID. The staging project reference is required.');
  }

  return value;
}
