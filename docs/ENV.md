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
| `EMAIL_TRANSACTIONAL_ENABLED` | no | Default `false`. No sender is wired yet |
| `EMAIL_DEV_PREVIEW` | no | Local only. Stores the last password-reset URL in `AppSetting` |
| `GMAIL_API_ENABLED` | no | Default off. The Gmail client is a stub and does not call Google. See `docs/GMAIL_OAUTH.md` |
| `STAGING_BASIC_AUTH` | staging | `username:password`. Required when `APP_ENV=staging` |
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
