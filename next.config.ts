import type { NextConfig } from "next";

function contentSecurityPolicy() {
  // Next's dev overlay rebuilds stacks with eval. Production does not.
  const script =
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // The app is served from its own host (app.amalfimedia.xyz). There is no
  // basePath and no assetPrefix: pages live at /admin and /portal, and Next
  // assets stay at /_next on that host. The public site at amalfimedia.xyz is
  // a different Nginx server block and is never modified.
  experimental: {
    // Server Actions stay at the 1 MB default. Photo bytes use the signed PUT.
    // The proxy clones that PUT, and Next's default clone stops at 10 MB, so a
    // larger photo would be stored short. 512mb matches the app ceiling and Nginx.
    proxyClientMaxBodySize: "512mb",
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "app.amalfimedia.xyz",
        "staging.amalfimedia.xyz",
      ],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
