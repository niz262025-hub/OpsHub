#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_ADMIN_EMAIL = `staging-admin-${Date.now()}@example.com`;
const DEFAULT_ADMIN_PASSWORD = 'TempPass123!';

function loadEnvFiles() {
  const candidates = ['.env.local', '.env'];
  for (const candidate of candidates) {
    const filePath = new URL(`../${candidate}`, import.meta.url);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    }
  }
}

function getRequiredEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

function runSupabaseQuery(projectRef, sql) {
  const result = spawnSync('npx', ['supabase@2.116.0', 'db', 'query', '--linked', '--project-ref', projectRef, sql], {
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = result.stdout || result.stderr || '';
    throw new Error(`supabase db query failed: ${output.trim() || `status=${result.status}`}`);
  }

  return result.stdout || '';
}

async function main() {
  loadEnvFiles();

  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const projectRef = getRequiredEnv('SUPABASE_PROJECT_ID');
  const adminEmail = process.env.STAGING_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.STAGING_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const created = await client.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Staging Admin',
    },
  });

  if (created.error) {
    throw new Error(`admin createUser failed: ${created.error.message}`);
  }

  const userId = created.data.user.id;
  const sql = `
    alter table public.profiles disable trigger profiles_security_guard;
    update public.profiles
      set role = 'ADMIN', account_status = 'ACTIVE'
      where id = '${userId}'::uuid;
    alter table public.profiles enable trigger profiles_security_guard;
    select id, role, account_status from public.profiles where id = '${userId}'::uuid;
  `;

  runSupabaseQuery(projectRef, sql);

  const signedIn = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await signedIn.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
  if (signIn.error) {
    throw new Error(`admin sign-in failed: ${signIn.error.message}`);
  }

  console.log(`STAGING_ADMIN_BOOTSTRAP_OK ${userId}`);
}

main().catch((error) => {
  console.error(`BLOCKER ${error?.message || String(error)}`);
  process.exit(1);
});
