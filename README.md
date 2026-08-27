# OpsHub

OpsHub is a private verified seller/reseller marketplace and community.

This repository now includes the Phase 0 foundation and Phase 1 authentication and seller verification scaffolding. The implementation keeps the app secure by using controlled admin access, seller-only registration, and verification gating without exposing secrets or business rules beyond the core access model.

## Quick start

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Run the checks with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/architecture/README.md](docs/architecture/README.md), and [docs/PROGRESS.md](docs/PROGRESS.md) for boundaries and status.
