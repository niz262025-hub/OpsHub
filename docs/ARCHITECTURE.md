# OpsHub Architecture

## Phase 0 boundaries

OpsHub is organized as a pnpm monorepo. The web client is a Next.js App Router application, the mobile client is an Expo React Native application, and Supabase owns the future PostgreSQL, authentication, storage, and Edge Function boundary.

## Phase 1 auth and verification

This phase introduces a secure seller access model:

- Supabase Auth handles email/password authentication and session persistence.
- Profiles are linked to `auth.users` and hold role and account status.
- Seller profiles hold onboarding details and verification state.
- Admin-controlled verification actions are limited to controlled admin accounts.
- Seller access is blocked unless the seller is both ACTIVE and VERIFIED.
- Public role selection is not available in the client.

## Repository layout

- `apps/web`: Next.js and Tailwind web client
- `apps/mobile`: Expo React Native client
- `packages/ui`: shared UI package boundary
- `packages/types`: shared TypeScript contracts
- `packages/utils`: shared, platform-agnostic utilities
- `packages/auth`: centralized auth and seller-verification policy helpers
- `supabase/migrations`: database migrations and trigger logic
- `supabase/functions`: Edge Functions, added when server workflows are defined
- `docs`: project documentation

## Dependency direction

Apps may depend on shared packages. Shared packages remain independent of application code. Supabase credentials are not committed to the repository and service-role keys are never exposed to the browser.

## Local development

1. Copy `.env.example` to `.env.local` and provide local Supabase values when needed.
2. Run `pnpm install`.
3. Run `pnpm dev` for the web app or `pnpm --filter @opshub/mobile start` for Expo.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before opening a pull request.
