# Supabase configuration

## Overview

OpsHub uses Supabase for authentication, session management, and Postgres-backed application data. The repository must keep public and server-side configuration strictly separated.

## Environments

### Development

Use a local or dev Supabase project for everyday engineering work. Keep all credentials in environment variables only and never commit them to Git.

Typical variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (current Supabase naming)
- NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy compatibility alias)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_PROJECT_ID

### Staging

Use a dedicated Supabase project for staging validation before merge. This environment should be isolated from production and should only be used for Phase 1 validation and QA.

## Required environment variables

Public/browser variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred/current name)
- NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy compatibility alias)

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

## Staging deployment checklist

For a safe staging deployment or browser UAT, use the repo as follows:

1. Create a dedicated staging Supabase project or reuse the linked staging project reference only for QA.
2. Populate environment variables from a secure secret store or an untracked `.env.local` file.
3. Keep public values in `NEXT_PUBLIC_*` variables only.
4. Keep server-only secrets in `SUPABASE_*` values and never expose them in client bundles.
5. Configure the external app URL separately from the database URL.
6. Run the repo checks before shipping or sharing the staging app.
7. Use sandbox or test mode for payment provider setup where supported; do not add fake success flows.

## Browser UAT and smoke-test setup

Browser smoke tests are intentionally minimal and require an externally supplied `BASE_URL`.

Required environment usage:

- `BASE_URL` for the public staging app
- `PLAYWRIGHT_TEST_SELLER_EMAIL`
- `PLAYWRIGHT_TEST_CUSTOMER_EMAIL`
- `PLAYWRIGHT_TEST_ADMIN_EMAIL`
- `PLAYWRIGHT_TEST_PASSWORD`

Authenticated browser tests must be skipped unless the external staging accounts are supplied. The repo does not fabricate users or credentials.

## Staging onboarding runbook

1. Link or select the dedicated staging Supabase project in the Supabase dashboard or CLI.
2. Apply all migrations to the staging database.
3. Set the required environment variables from a secure secret store or untracked local file.
4. Create or prepare one CUSTOMER, one SELLER, and one ADMIN staging account.
5. Mark the seller as VERIFIED and publish at least one product with inventory.
6. Deploy or start the OpsHub app using the staging Supabase values.
7. Set `BASE_URL` to the staging application URL.
8. Run the Playwright authenticated suite only after all values are present.
9. Verify that a real order is created via `create_order_for_product`.
10. Verify inventory decreases after checkout.
11. Verify customer/seller/admin isolation rules at runtime.
12. Run the final local quality gate before release.

## Safe environment validation

Use this command to check whether required variables exist without printing values:

```bash
node ./scripts/check-staging-env.mjs
```

This script exits non-zero if required variables are missing or still placeholder values remain, and does not print secret values.
