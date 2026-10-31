import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { stagingGate } from "../../src/lib/staging-gate";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_dev";
const shots = "/opt/cursor/artifacts/screenshots";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function sql(query: string) {
  return execFileSync("psql", [databaseUrl, "-tA", "-c", query], { encoding: "utf8" }).trim();
}

function codeFor(email: string) {
  const value = sql(`SELECT value->>'code' FROM "AppSetting" WHERE key = 'dev.portalOtp:${email}'`);
  expect(value, email).toMatch(/^\d{6}$/);
  return value;
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

test("portal bypasses the staging password and admin does not", () => {
  const base = { appEnv: "staging", basicAuth: "preview:secret", authorizationHeader: null };
  for (const pathname of ["/portal/login", "/portal/invite", "/portal/galleries/abc/download", "/portal/api/auth/sign-in/email-otp", "/api/auth/sign-in/email"]) {
    expect(stagingGate({ ...base, pathname }).action, pathname).toBe("allow");
  }
  for (const pathname of ["/admin", "/admin/login", "/api/bot"]) {
    expect(stagingGate({ ...base, pathname }).action, pathname).toBe("challenge");
  }
});

test("a realtor can sign in with an email code", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  const email = "client.demo@amalfimedia.xyz";
  await page.goto("/portal/login");
  await setTheme(page, "light");
  await expect(page.getByTestId("portal-otp-email")).toBeVisible();
  await page.screenshot({ path: `${shots}/portal-otp-email-light.png`, fullPage: true });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: `${shots}/portal-otp-email-dark.png`, fullPage: true });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${shots}/portal-otp-email-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByTestId("portal-otp-code")).toBeVisible();
  await page.screenshot({ path: `${shots}/portal-otp-code-light.png`, fullPage: true });
  const code = codeFor(email);
  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Sign-in code").fill(wrong);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("portal-otp-error")).toBeVisible();
  await page.screenshot({ path: `${shots}/portal-otp-error-light.png`, fullPage: true });

  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
});

test("an expired sign-in code is rejected", async ({ page }) => {
  const email = "client.demo@amalfimedia.xyz";
  await page.goto("/portal/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  const code = codeFor(email);
  sql(`UPDATE verification SET "expiresAt" = NOW() - INTERVAL '1 minute' WHERE identifier = 'sign-in-otp-${email}'`);
  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("portal-otp-error")).toContainText(/expired/i);
});

test("an invite code attaches the existing client and does not create another", async ({ page, browser }) => {
  mkdirSync(shots, { recursive: true });
  const stamp = Date.now();
  const email = `otp-${stamp}@example.com`;
  const address = `${stamp} Code Way`;

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await page.goto("/admin/crm/leads/new");
  await page.getByLabel("First name").fill("Riley");
  await page.getByLabel("Last name").fill("Cole");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create realtor" }).click();
  await expect(page.getByRole("heading", { name: "Riley Cole" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await page.getByRole("link", { name: "Add listing" }).click();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: "front.png", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published for the client.").first()).toBeVisible();
  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel("Invite link")).toBeVisible();
  const inviteUrl = await page.getByLabel("Invite link").inputValue();

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(inviteUrl);
  await expect(guestPage.getByRole("heading", { name: "Gallery invite" })).toBeVisible();
  await expect(guestPage.getByLabel("Email")).toHaveValue(email);
  await guestPage.screenshot({ path: `${shots}/portal-otp-invite-light.png`, fullPage: true });
  await guestPage.getByRole("button", { name: "Email me a code" }).click();
  await expect(guestPage.getByLabel("Sign-in code")).toBeVisible();
  await guestPage.getByLabel("Sign-in code").fill(codeFor(email));
  await guestPage.getByRole("button", { name: "Sign in" }).click();
  await expect(guestPage.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });
  await expect(guestPage).toHaveURL(/\/portal\/galleries\//);
  expect(sql(`SELECT count(*) FROM "Client" WHERE lower(email) = '${email}'`)).toBe("1");
  expect(sql(`SELECT "userId" IS NOT NULL FROM "Client" WHERE lower(email) = '${email}'`)).toBe("t");
  expect(sql(`SELECT count(*) FROM "user" WHERE email = '${email}'`)).toBe("1");
  await guest.close();
});
