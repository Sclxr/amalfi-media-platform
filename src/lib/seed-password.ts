export const LOCAL_DEMO_PASSWORD = "Amalfi-Demo-2026!";

/**
 * The README demo password is for APP_ENV=development only.
 * Staging, test, and production must set a different SEED_ADMIN_PASSWORD.
 */
export function resolveSeedPassword(input: {
  appEnv: string | undefined;
  seedAdminPassword?: string | undefined;
}): string {
  const appEnv = input.appEnv?.trim() || "development";
  const fromEnv = input.seedAdminPassword?.trim() ?? "";
  if (appEnv === "development") {
    return fromEnv || LOCAL_DEMO_PASSWORD;
  }
  if (!fromEnv) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD. The local demo password is only used when APP_ENV=development.",
    );
  }
  if (fromEnv === LOCAL_DEMO_PASSWORD) {
    throw new Error(
      "The local demo password is refused outside development. Set a different SEED_ADMIN_PASSWORD.",
    );
  }
  return fromEnv;
}
