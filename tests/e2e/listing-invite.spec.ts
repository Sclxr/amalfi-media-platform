import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const shots = "/opt/cursor/artifacts/screenshots";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

test("an admin can copy an invite and a new account claims that gallery", async ({ page, browser }) => {
  mkdirSync(shots, { recursive: true });
  const stamp = Date.now();
  const email = `invite-${stamp}@example.com`;
  const address = `${stamp} Invite Way`;
  const clientPassword = "Invite-Claim-2026!";

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/crm/leads/new");
  await page.getByLabel("First name").fill("Riley");
  await page.getByLabel("Last name").fill("Chen");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create realtor" }).click();
  await expect(page.getByRole("heading", { name: "Riley Chen" })).toBeVisible();
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
  await expect(page.getByText("Published for the client.")).toBeVisible();

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Send invite by email" }).click();
  await expect(page.getByText("Invite logged only (staging/not allowlisted)")).toBeVisible();
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel("Invite link")).toBeVisible();
  const inviteUrl = await page.getByLabel("Invite link").inputValue();
  expect(inviteUrl).toContain("/portal/invite?token=");
  await page.screenshot({ path: `${shots}/listing-invite-desktop-light.png`, fullPage: true });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: `${shots}/listing-invite-desktop-dark.png`, fullPage: true });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${shots}/listing-invite-mobile-light.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(inviteUrl);
  await expect(guestPage.getByRole("heading", { name: "Gallery invite" })).toBeVisible();
  await expect(guestPage.getByText(address)).toBeVisible();
  await guestPage.screenshot({ path: `${shots}/portal-invite-light.png`, fullPage: true });
  await setTheme(guestPage, "dark");
  await guestPage.screenshot({ path: `${shots}/portal-invite-dark.png`, fullPage: true });
  await setTheme(guestPage, "light");
  await guestPage.getByRole("link", { name: "Create an account" }).click();
  await expect(guestPage).toHaveURL(/\/portal\/register\?/);
  await guestPage.getByRole("button", { name: "Create a password instead" }).click();
  expect(guestPage.url()).toContain("invite=");
  expect(guestPage.url()).toContain("next=");
  await guestPage.getByLabel("Name").fill("Riley Chen");
  await guestPage.getByLabel("Email").fill(email);
  await guestPage.getByLabel("Password").fill(clientPassword);
  await guestPage.getByRole("button", { name: "Create account" }).click();
  await expect(guestPage.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });
  await expect(guestPage).toHaveURL(/\/portal\/galleries\//);
  await guestPage.screenshot({ path: `${shots}/portal-invite-gallery-light.png`, fullPage: true });
  await guest.close();
});
