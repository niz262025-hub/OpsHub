# OpsHub

OpsHub is a private verified seller/reseller marketplace and community.

This repository contains the Phase 0 foundation: a pnpm monorepo with a Next.js web app, Expo mobile app, shared TypeScript package boundaries, Supabase directories, and CI quality gates. Product workflows are intentionally not implemented yet.

## Quick start

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Run the checks with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PROGRESS.md](docs/PROGRESS.md) for boundaries and status.
