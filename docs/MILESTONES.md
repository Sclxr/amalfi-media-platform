# Milestones

Status as of 31 October 2026. Listings are this pull request.

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

## Milestone 3 — Bookings and orders

- [x] Availability rules and blackout dates
- [x] Admin calendar in day, week, and month views
- [x] Portal booking request: property, $120 intro package, quote-only drone and video add-ons, travel fee by service area
- [x] Order lifecycle requested → quoted → scheduled → shot → editing → delivered → cancelled, with history
- [x] Quote builder for quote-priced items
- [x] Transactional email templates, preview only outside production
- [x] `.ics` export

## Milestone 4 — Billing and galleries

- [x] Stripe Checkout when keys are present. Missing keys leave billing not configured and the app still boots
- [x] Webhook signature check and idempotent processing. Card data is not stored
- [x] Invoice list and detail in admin and the portal, with receipt links
- [x] Signed gallery uploads, watermark-free previews, pay-before-download, trusted-client override, zip download, and download audit

## Listings

- [x] `/admin/listings` cards use the property, the CRM realtor, the latest non-cancelled order, and a gallery cover
- [x] A realtor profile lists those same properties and can create one without sending email

## Later

Worker jobs beyond the heartbeat, a GHCR image push, and Sentry are still open.
