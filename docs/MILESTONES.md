# Milestones

Status as of 30 October 2026. Milestone 1 is on develop. Milestone 2 is this pull request.

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

## Milestone 2 — CRM growth and outreach

- [x] CSV import with column mapping, dedupe on normalized email and phone, preview, and an error report
- [x] Activity timeline, follow-up queue, and tasks
- [x] Campaigns with segments, templates, and admin approval
- [x] CAN-SPAM postal address (Orlando, FL), unsubscribe link, suppression list, and one-click `List-Unsubscribe`
- [x] Sending stays off unless `APP_ENV=production` and `EMAIL_MARKETING_ENABLED=true`
- [x] Gmail API stub and OAuth plan (`docs/GMAIL_OAUTH.md`)
- [x] Marketing bot API keys, draft-only

## Later

Bookings, orders, Stripe, and galleries are the next milestones. The tables for them are already in the database.
