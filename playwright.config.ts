import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_dev";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3000/portal/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_ENV: "development",
      APP_URL: "http://127.0.0.1:3000",
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "local-dev-auth-secret-32-characters",
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "local-dev-encryption-key-32-chars",
      EMAIL_MARKETING_ENABLED: "false",
      EMAIL_DEV_PREVIEW: "true",
      MEDIA_ROOT: process.env.MEDIA_ROOT ?? "/tmp/amalfi-e2e-media",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
