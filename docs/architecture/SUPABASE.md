# Supabase configuration

## Overview

OpsHub uses Supabase for authentication, session management, and Postgres-backed application data. The repository must keep public and server-side configuration strictly separated.

## Environments

### Development

Use a local or dev Supabase project for everyday engineering work. Keep all credentials in environment variables only and never commit them to Git.

Typical variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_PROJECT_ID

### Staging

Use a dedicated Supabase project for staging validation before merge. This environment should be isolated from production and should only be used for Phase 1 validation and QA.

## Required environment variables

Public/browser variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Server-only variables:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_PROJECT_ID

Important:

- Public variables are safe to expose to the browser.
- Server-only variables must never be imported into client-side code.
- `SUPABASE_SERVICE_ROLE_KEY` must never be used in browser code or committed to source files.

## Connecting a Supabase project

1. Create or select the Supabase project in the Supabase dashboard.
2. Copy the project URL and anon key from the project settings.
3. Set them in the environment for local or staging use.
4. For server operations, set `SUPABASE_SERVICE_ROLE_KEY` and the project metadata only in a secure environment.
5. Never hardcode the values in source files or commit them to Git.

## Applying migrations

Use the Supabase CLI in a secure environment:

```bash
npx supabase@2.116.0 init
npx supabase@2.116.0 link --project-ref <project-ref>
npx supabase@2.116.0 db push
```

If a fresh database is required for validation:

```bash
npx supabase@2.116.0 db reset
```

## Running database/RLS validation

After the project is linked and migrations are applied, run the validation flow against the staging database:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additionally, validate the real database rules with staging-specific RLS and auth-trigger tests covering:

- unauthenticated access denied
- seller can read own profile only
- seller cannot read another seller profile
- seller cannot change role or status
- seller cannot insert VERIFIED or other non-PENDING values
- new seller registration creates a PENDING seller record
- admin can approve, reject, and suspend

## Secret safety rules

- Never print secrets to logs or final reports.
- Never commit `.env` files or credential material.
- Never import server-only secrets into browser/client bundles.
- Keep all credential handling in process environment variables or a secure secret manager.

## Safe environment validation

Use this command to check whether required variables exist without printing values:

```bash
node ./scripts/check-supabase-env.mjs
```

This script exits non-zero if required variables are missing and does not print secret values.
