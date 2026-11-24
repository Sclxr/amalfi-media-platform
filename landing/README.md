# Amalfi Media landing site

This folder is the public site for `https://amalfimedia.xyz`. It is a static Astro build. It is not part of the Next.js platform app, and this repository change does not deploy it.

## Build

```bash
cd landing
pnpm install
pnpm build
```

`pnpm build` is the preview build. It keeps the placeholder notes so the draft can be reviewed.

`pnpm build:prod` is the build that may be uploaded. It stops, and prints the list, while any of these are still unconfirmed in `src/site.config.ts`:

- `phone.confirmed` and `phone.dial`
- `prices.confirmed`
- `areas.confirmed`
- `claims.reviewed` (24-hour turnaround, FAA Part 107, and insured)

A production build never prints “not confirmed”, “(placeholder)”, or “cities to confirm”. Testimonials, the headshot, the bio, and social links are left out of that HTML when they are empty, instead of showing a placeholder. Those empty sections are listed by the check and do not, by themselves, stop the build.

The site is written to `landing/dist`. `pnpm preview` serves that folder locally.

## What is still a placeholder

Open `src/site.config.ts`. Prices, the phone number, service-area cities, testimonials, the headshot and bio, social links, and the FAA / insured / 24-hour claims are marked unconfirmed. The preview pages render those as placeholders. Do not upload a preview build. Use `pnpm build:prod` only after the flags above are set.

The client portal link defaults to `https://staging.amalfimedia.xyz/portal`.

## Booking form

The form posts to the same FormSubmit address as the current live contact form: `https://formsubmit.co/eathen@amalfimedia.xyz`. Captcha is on, a honeypot field is included, and success redirects to `https://amalfimedia.xyz/book/thanks/`.

## Later switch on the server

Do this only when the new site is approved. Do not run it as part of a code change.

1. On the VPS, copy the current web root aside before replacing it:

```bash
sudo cp -a /var/www/amalfimedia.xyz /var/www/amalfimedia.xyz.bak-$(date +%Y%m%d)
```

Use the real root path for the live site. The backup is the rollback.

2. Upload `landing/dist` into a new directory, for example `/var/www/amalfimedia.xyz-next`.

3. Point nginx at that directory only after checking a file listing and the form action in `book/index.html`.

4. Reload nginx. If anything is wrong, point the root back at the backup and reload again.

## Nginx snippet (not applied)

```nginx
server {
  listen 80;
  server_name amalfimedia.xyz www.amalfimedia.xyz;
  return 301 https://amalfimedia.xyz$request_uri;
}

server {
  listen 443 ssl;
  server_name www.amalfimedia.xyz;
  return 301 https://amalfimedia.xyz$request_uri;
}

server {
  listen 443 ssl;
  server_name amalfimedia.xyz;
  root /var/www/amalfimedia.xyz;
  index index.html;

  error_page 404 /404.html;
  location = /404.html { internal; }

  location / {
    try_files $uri $uri/ $uri.html =404;
  }

  location ~* \.(avif|webp|svg|css|js|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
  }
}
```

Keep the existing certificate lines. This snippet only shows the redirects, the real 404, and cache headers.
