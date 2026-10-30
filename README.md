# Amalfi Media platform

Operations app for Amalfi Media (Orlando and Central Florida). Staff use `/admin`. Clients use `/portal`. The public site at `amalfimedia.xyz` is a different host and is not part of this app.

Milestone 1 is the foundation: database, Better Auth, the admin shell, overview, CRM, a client portal shell, and a staging configuration that cannot send marketing email.

## Local setup

Requirements: Node.js 22, pnpm 10, PostgreSQL 16.

```bash
pnpm install
cp .env.example .env
```

Put a local database URL and two random secrets (32+ characters) in `.env`:

```bash
APP_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_dev
DIRECT_URL=postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_dev
AUTH_SECRET=...
ENCRYPTION_KEY=...
EMAIL_MARKETING_ENABLED=false
```

Do not set `NODE_ENV` in `.env`. Next.js sets it, and overriding it breaks `next build`.

```bash
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

Open http://localhost:3000.

`infra/docker-compose.dev.yml` starts Postgres, MinIO, and Mailpit if you do not already have Postgres.

## Demo sign-in

Local seed only. The demo password is used only when `APP_ENV=development` and `SEED_ADMIN_PASSWORD` is unset. Staging, test, and production refuse that password, including when it is pasted into `SEED_ADMIN_PASSWORD`.

| Role | Email | Password |
| --- | --- | --- |
| Admin | eathen@amalfimedia.xyz | `Amalfi-Demo-2026!` |
| Staff | staff.demo@amalfimedia.xyz | `Amalfi-Demo-2026!` |
| Client | client.demo@amalfimedia.xyz | `Amalfi-Demo-2026!` |

Any environment other than development refuses to seed until `SEED_ADMIN_PASSWORD` is set to something other than the demo password. Do not reuse the local demo password on a public URL. Re-running the seed resets those three demo passwords and upserts the demo records. It does not delete realtors you add afterward.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm exec prisma validate
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test` is Vitest (unit plus Postgres isolation). `pnpm test:e2e` is Playwright against `pnpm start`, so build first. `pnpm start` migrates, seeds only when `seed.completed` is missing, then serves the standalone server. Point `DATABASE_URL` at the dev database for e2e. Vitest uses `amalfi_test` locally and `DATABASE_URL` in CI.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Environment](docs/ENV.md)
- [Deployment](docs/DEPLOYMENT.md) — Neon + Render staging, and a future Nginx vhost
- [Milestones](docs/MILESTONES.md)
- [Changelog](CHANGELOG.md)
