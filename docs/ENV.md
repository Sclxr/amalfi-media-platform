# Environment

Copy `.env.example` to `.env`. Never commit `.env`. Do not put `NODE_ENV` in the file.

| Name | Required | Notes |
| --- | --- | --- |
| `APP_ENV` | yes | `development`, `test`, `staging`, or `production` |
| `APP_URL` | yes | Public origin of this app, including scheme |
| `DATABASE_URL` | yes | Postgres URL the app uses. On Neon, the pooled URL |
| `DIRECT_URL` | yes for Prisma | Non-pooled URL for `prisma migrate`. Locally, copy `DATABASE_URL` |
| `AUTH_SECRET` | yes | 32+ characters. Session signing |
| `ENCRYPTION_KEY` | yes | 32+ characters. Reserved for TOTP and token encryption |
| `EMAIL_MARKETING_ENABLED` | no | Default `false`. Boot fails if `true` outside production |
| `EMAIL_TRANSACTIONAL_ENABLED` | no | Default `false`. Production sends only when this is `true` and a provider is configured. Staging also sends when this and `EMAIL_STAGING_SEND` are both `true` |
| `EMAIL_STAGING_SEND` | no | Default `false`. Set `true` on staging to deliver transactional mail. Ignored in development and test. An empty `EMAIL_STAGING_ALLOWLIST` still sends to every recipient; set the allowlist |
| `EMAIL_STAGING_ALLOWLIST` | no | Comma-separated emails and domains, for example `eathen@amalfimedia.xyz, amalfimedia.xyz`. Used only when staging sending is on. Empty means no restriction |
| `EMAIL_DEV_PREVIEW` | no | Local and test only. Stores the last password-reset, verification, invite, receipt, and sign-in code in `AppSetting`. Leave `false` on staging and production |
| `EMAIL_PROVIDER` | no | `resend` or `smtp`. Required to send, together with `EMAIL_FROM` |
| `EMAIL_FROM` | no | From address, such as `Amalfi Media <hello@amalfimedia.xyz>` |
| `RESEND_API_KEY` | no | Required when `EMAIL_PROVIDER=resend` |
| `SMTP_HOST` | no | Required when `EMAIL_PROVIDER=smtp` |
| `SMTP_PORT` | no | Required when `EMAIL_PROVIDER=smtp`. `465` uses TLS |
| `SMTP_USER` | no | SMTP username, when the server requires auth |
| `SMTP_PASSWORD` | no | SMTP password |
| `STRIPE_API_BASE` | no | Defaults to `https://api.stripe.com`. Production refuses any other host |
| `GMAIL_API_ENABLED` | no | Default off. The Gmail client is a stub and does not call Google. See `docs/GMAIL_OAUTH.md` |
| `STAGING_GATE` | no | `on` (default) or `off`. On staging, `off` skips the basic-auth password for every path. Admin pages still require an admin session. Ignored outside staging |
| `STAGING_BASIC_AUTH` | staging | `username:password`. Required when `APP_ENV=staging` and `STAGING_GATE` is `on`. Protects `/admin`. `/portal` and `/api/auth` do not ask for it |
| `STRIPE_SECRET_KEY` | no | Staging must be `sk_test_`. Production must not be a test key |
| `STRIPE_WEBHOOK_SECRET` | no | Signing secret for `POST /api/stripe/webhook`. Comma-separated while rotating so both secrets are accepted. Subscribe the endpoint to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | Staging must be `pk_test_` |
| `S3_ENDPOINT` | no | R2 S3 API endpoint |
| `S3_REGION` | no | `auto` for R2 |
| `S3_BUCKET` | no | Staging name must include `staging` |
| `S3_ACCESS_KEY_ID` | no | R2 token |
| `S3_SECRET_ACCESS_KEY` | no | R2 secret |
| `MEDIA_ROOT` | staging/prod | Directory for photos. Staging path must contain `staging` |
| `MEDIA_MAX_UPLOAD_BYTES` | no | Max bytes for one signed upload. Default 50 MB. Ceiling 512 MB |
| `SENTRY_DSN` | no | Reserved. Errors currently go to pino |
| `LOG_LEVEL` | no | Default `info` |
| `SEED_ADMIN_PASSWORD` | staging/prod seed | Required to seed outside development and test |

Generate secrets with `openssl rand -base64 32`.
