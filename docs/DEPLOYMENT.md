# Deployment

Nothing in this milestone is deployed. These are the steps to stand up an isolated staging app on Neon and Render. Do not point it at a production database, bucket, or Stripe live key. Do not change the public site at `amalfimedia.xyz`.

## 1. Neon database

1. Create a Neon project named `amalfi-staging`. Do not reuse a project you will later use for production.
2. Create a database named `amalfi_staging` (or use a Neon branch named `staging` whose connection string is stored only on the staging host).
3. Copy the **pooled** connection string. It looks like `postgresql://USER:PASSWORD@ep-....aws.neon.tech/amalfi_staging?sslmode=require`.
4. Confirm the URL does not contain `amalfi_prod` or `/prod`.

## 2. Cloudflare R2

1. Create a bucket named `amalfi-staging`. The app rejects a staging bucket whose name does not include `staging`.
2. Create an R2 API token that can read and write only that bucket.
3. Note the S3 endpoint, `https://<accountid>.r2.cloudflarestorage.com`, the access key, and the secret. Region is `auto`.
4. Leave the bucket private. The app will use presigned URLs later. No public access.

## 3. Render web service

1. New **Web Service**, connect the GitHub repo `amalfi-media-platform`.
2. Branch: `develop` after this PR is merged. Until then you can point a temporary service at the feature branch.
3. Runtime: Node. Set Node to 22 (`NODE_VERSION=22`).
4. Build command:

```bash
pnpm install --frozen-lockfile && pnpm build
```

5. Start command:

```bash
pnpm start
```

`pnpm start` runs `next start`. The build also sets `output: "standalone"` for a future VPS. Next prints a warning about that. Locally, `next start` still served HTML and CSS; that is what the Playwright run used. If Render refuses to boot because of the warning, start with the standalone server instead:

```bash
cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static && node .next/standalone/server.js
```

6. Health check path: `/portal/api/health`. This path is exempt from the staging basic-auth gate so Render can probe it. It returns 200 only when Postgres answers.
7. Instance count: 1 for now. The per-account login limiter is in memory on each instance. The Better Auth limiter is in Postgres.

### Environment variables

Set these on the Render service before the first build. The auth module reads them when the server starts, and `next build` imports that module, so they must exist at build time too.

| Key | Value |
| --- | --- |
| `APP_ENV` | `staging` |
| `APP_URL` | `https://<service>.onrender.com` first, then `https://staging.amalfimedia.xyz` after DNS |
| `DATABASE_URL` | Neon pooled URL from step 1 |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | a different `openssl rand -base64 32` |
| `EMAIL_MARKETING_ENABLED` | `false` |
| `EMAIL_TRANSACTIONAL_ENABLED` | `false` |
| `EMAIL_DEV_PREVIEW` | `false` |
| `STAGING_BASIC_AUTH` | `preview:<long-random-password>` |
| `STRIPE_SECRET_KEY` | blank, or `sk_test_...` only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | blank, or `pk_test_...` only |
| `STRIPE_WEBHOOK_SECRET` | blank until billing |
| `S3_ENDPOINT` | R2 endpoint |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `amalfi-staging` |
| `S3_ACCESS_KEY_ID` | R2 access key |
| `S3_SECRET_ACCESS_KEY` | R2 secret |
| `SEED_ADMIN_PASSWORD` | a password you choose, not the local demo password |
| `LOG_LEVEL` | `info` |

Do not set `NODE_ENV`. Render and Next set it.

If any of these are wrong, the process exits during env parsing: marketing flag true, a live Stripe key, a bucket without `staging` in the name, a missing basic-auth secret, or a database URL that looks like production.

## 4. Migrate and seed

Render pre-deploy command:

```bash
pnpm exec prisma migrate deploy && pnpm exec prisma db seed
```

`prisma` and `tsx` are runtime dependencies so this works after `pnpm install`. The seed upserts demo brokerages, the $120 introductory package, quote-priced add-ons, travel zones at `$0` until you edit them, and three users. It does not delete CRM rows that lack a `seed:` external ref.

Sign in at `/admin/login` with `eathen@amalfimedia.xyz` and `SEED_ADMIN_PASSWORD`. The browser will first ask for the `STAGING_BASIC_AUTH` user and password.

## 5. DNS

Add a CNAME for `staging.amalfimedia.xyz` to the Render hostname. Update `APP_URL` to `https://staging.amalfimedia.xyz` and redeploy. Add the same host under Render custom domains so TLS is issued. Do not add a record that sends `amalfimedia.xyz` or `www` to this service.

The app responds with `noindex` and a robots disallow. Leave it that way on staging.

## 6. What staging must not share

| | Staging | Production later |
| --- | --- | --- |
| Neon | `amalfi-staging` project or branch | a different project |
| R2 | `amalfi-staging` | `amalfi-prod` |
| Stripe | test keys only | live keys |
| Marketing email | forced off | off until you set the flag |
| Access | basic auth plus app login | app login |
| Host | `staging.amalfimedia.xyz` or the onrender.com URL | `app.amalfimedia.xyz` |

## Future VPS and Nginx

Do not apply this until a production deploy is approved, and do not edit the existing public-site server block.

1. DNS: `app.amalfimedia.xyz` to the VPS. A separate `staging.amalfimedia.xyz` record can point at Render until you move it.
2. Install the files in `infra/nginx/` as a **new** site. `app.amalfimedia.xyz.conf` proxies every path on that host to `127.0.0.1:3100`. `/_next` is included because the whole host is proxied. The public site never sees those paths.
3. TLS for `app.amalfimedia.xyz` only. Do not change the certificate or `root` of `amalfimedia.xyz`.
4. Run the app as the `amalfi` user with `infra/systemd/amalfi-web.service`, bound to localhost.
5. Rollback is removing the new server block and reloading Nginx. The public site does not depend on it.

A later staging vhost on the VPS would be another server block and another port, with its own env file. It still must not use the production database or bucket.
