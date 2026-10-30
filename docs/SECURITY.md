# Security notes for Milestone 1

- Passwords are argon2id. Common breached passwords in a local list are rejected. This is not the full Have I Been Pwned corpus.
- Role cannot be set by the sign-up form. A database check constraint only allows `ADMIN`, `STAFF`, and `CLIENT`.
- Session cookies are httpOnly and SameSite=Lax. They are Secure on https.
- Admin layouts return 404 to client sessions. Staff without `settings.manage` get 404 on the catalog.
- Client repositories always filter by the client id stored on the user, not by an id from the query string.
- Staging requires basic auth and refuses live Stripe keys, a production-looking database URL, a non-staging bucket name, and `EMAIL_MARKETING_ENABLED=true`.
- CSP allows inline scripts so Next.js can hydrate. Tightening that to nonces is follow-up work.
- The per-account login limiter lives in process memory. Better Auth's IP limiter is stored in Postgres.
