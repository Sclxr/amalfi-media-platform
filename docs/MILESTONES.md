# Milestones

Status as of 30 October 2026. This pull request is Milestone 1. It is not deployed.

## Milestone 1 — Foundation

- [x] Next.js, TypeScript, Tailwind, owned shadcn-style UI, pnpm, ESLint
- [x] Zod env parsing and `.env.example`
- [x] Prisma schema, migration, and re-runnable seed
- [x] Better Auth: email/password, database sessions, argon2id, reset, optional TOTP, rate limits
- [x] RBAC for admin, staff, and client, enforced on the server
- [x] Client queries scoped to the signed-in client
- [x] Audit log on login and CRM writes
- [x] Admin shell: sidebar, header, command menu, light/dark
- [x] Overview cards and charts from the database
- [x] CRM: realtors and brokerages, create, edit, detail, notes, status, search
- [x] Catalog edits for package price, add-ons, and travel fees
- [x] Portal login, registration, and an empty-safe dashboard
- [x] Marketing send hard-disabled outside production, with tests
- [x] Staging gate, noindex, Stripe test-key check, separate-bucket check
- [x] Vitest and Playwright
- [x] GitHub Actions CI
- [x] Docs for architecture, env, and Neon + Render
- [ ] Staging URL actually running (not deployed; steps are in `docs/DEPLOYMENT.md`)
- [ ] Sentry SDK (DSN is reserved; logs go to pino)
- [ ] Husky pre-commit hook

## Later

Imports, campaigns, booking, orders, Stripe, galleries, and the VPS cutover are out of this milestone. The tables for them are already in the migration.
