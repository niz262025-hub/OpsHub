# OpsHub Architecture

## Phase 0 boundaries

OpsHub is organized as a pnpm monorepo. The web client is a Next.js App Router application, the mobile client is an Expo React Native application, and Supabase owns the future PostgreSQL, authentication, storage, and Edge Function boundary.

## Repository layout

- `apps/web`: Next.js and Tailwind web client
- `apps/mobile`: Expo React Native client
- `packages/ui`: shared UI package boundary
- `packages/types`: shared TypeScript contracts
- `packages/config`: shared configuration package boundary
- `packages/utils`: shared, platform-agnostic utilities
- `supabase/migrations`: database migrations, added when domain rules are defined
- `supabase/functions`: Edge Functions, added when server workflows are defined
- `docs`: project documentation

## Dependency direction

Apps may depend on shared packages. Shared packages must remain independent of application code. Supabase is an infrastructure boundary and is intentionally empty in Phase 0; no business rules or credentials belong here yet.

## Local development

1. Copy `.env.example` to `.env.local` and provide local Supabase values when needed.
2. Run `pnpm install`.
3. Run `pnpm dev` for the web app or `pnpm --filter @opshub/mobile start` for Expo.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before opening a pull request.
