# App host is app.amalfimedia.xyz

The public site stays on `amalfimedia.xyz`. The platform is a separate host, `app.amalfimedia.xyz`, with `/admin` and `/portal` as normal routes.

No Next.js `basePath` or `assetPrefix`. Assets stay at `/_next` on the app host. A future Nginx config is a new server block that proxies that host only. The existing public-site server block is not modified.

Staging is `staging.amalfimedia.xyz` or a temporary Render URL, with its own database and bucket.
