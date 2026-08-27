#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_ID',
];

const PUBLIC_KEY_ENV_VARS = ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const STAGING_PROJECT_ID = 'iytiyugzmlsofwtortth';

function readSimpleEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    process.env[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return true;
}

function loadEnvFiles() {
  const requestedEnvFile = process.argv.find((arg) => arg.startsWith('--env-file='));
  const candidates = [];

  if (requestedEnvFile) {
    const requestedPath = requestedEnvFile.split('=')[1];
    if (requestedPath) {
      candidates.push(path.resolve(process.cwd(), requestedPath));
    }
  }

  candidates.push(
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      readSimpleEnvFile(candidate);
    }
  }
}

function isNonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function printMissingVariables(missingKeys) {
  console.error('Missing required Supabase environment variables:');
  for (const key of missingKeys) {
    console.error(`- ${key}`);
  }
  console.error('Set them in your shell or a local untracked .env.local file before running this script.');
}

function hasPublicKeyConfigured() {
  return PUBLIC_KEY_ENV_VARS.some((key) => isNonBlank(process.env[key]));
}

function validateProjectReference() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const urlCandidates = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]
    .filter(isNonBlank);

  if (!projectId || projectId.trim() !== STAGING_PROJECT_ID) {
    console.error(`SUPABASE_PROJECT_ID must be set to ${STAGING_PROJECT_ID} for the staging project.`);
    return false;
  }

  for (const value of urlCandidates) {
    try {
      const parsed = new globalThis.URL(value);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes(STAGING_PROJECT_ID)) {
        console.error(`Supabase URL does not match project reference ${STAGING_PROJECT_ID}.`);
        return false;
      }
    } catch {
      console.error('Supabase URL is invalid. Expected a full https://...supabase.co URL.');
      return false;
    }
  }

  return true;
}

function runCommand(command, args, label) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`Failed to run ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${label} exited with status ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

function ensureSupabaseCli() {
  runCommand('npx', ['supabase@2.116.0', '--version'], 'Checking Supabase CLI availability');
}

function main() {
  loadEnvFiles();

  const missing = REQUIRED_ENV_VARS.filter((key) => !isNonBlank(process.env[key]));
  if (!hasPublicKeyConfigured()) {
    missing.push(...PUBLIC_KEY_ENV_VARS);
  }

  const dedupedMissing = [...new Set(missing)];
  if (dedupedMissing.length > 0) {
    printMissingVariables(dedupedMissing);
    process.exit(1);
  }

  if (!validateProjectReference()) {
    process.exit(1);
  }

  ensureSupabaseCli();

  runCommand('node', ['./scripts/check-supabase-env.mjs'], 'Validating required environment variables without printing secrets');
  runCommand('npx', ['supabase@2.116.0', 'login'], 'Authenticating to Supabase');
  runCommand('npx', ['supabase@2.116.0', 'link', '--project-ref', STAGING_PROJECT_ID], 'Linking to the staging project');
  runCommand('npx', ['supabase@2.116.0', 'db', 'push'], 'Applying migrations to staging');
  runCommand('npx', ['supabase@2.116.0', 'db', 'lint'], 'Running migration validation against the linked staging project');

  console.log('\nSupabase staging setup is complete up to the linked-project validation step.');
  console.log('The repository does not currently contain a live RLS/auth-trigger test runner for Supabase staging, so those checks must be executed against the linked project before claiming full staging validation pass.');
  console.log('Use the live staging checks in the project QA checklist to validate RLS, auth triggers, seller escalation, and admin flows.');
}

main();
