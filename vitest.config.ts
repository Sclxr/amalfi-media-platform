import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl = process.env.CI
  ? process.env.DATABASE_URL
  : "postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      APP_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: databaseUrl ?? "postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_test",
      AUTH_SECRET: "test-only-secret-not-for-production-ok",
      ENCRYPTION_KEY: "test-only-encryption-key-32chars!",
      EMAIL_MARKETING_ENABLED: "false",
      EMAIL_DEV_PREVIEW: "true",
    },
  },
});
