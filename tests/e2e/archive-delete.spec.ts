import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const shots = "/opt/cursor/artifacts/screenshots";
const mediaRoot = process.env.MEDIA_ROOT ?? "/tmp/amalfi-e2e-media";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
}

async function signIn(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
}

test("a listing can be archived, found, and restored", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  const address = `${Date.now()} Archive Road`;
  await signIn(page, "eathen@amalfimedia.xyz");
  await page.goto("/admin/crm/leads");
  await page.getByRole("link", { name: "Jordan Hale" }).click();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await page.getByRole("link", { name: "Add listing" }).click();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32809");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await page.goto("/admin/listings");
  await setTheme(page, "light");
  await page.getByRole("button", { name: `Actions for ${address}` }).click();
  await page.screenshot({ path: `${shots}/archive-row-menu-light.png` });
  await setTheme(page, "dark");
  await page.getByRole("button", { name: `Actions for ${address}` }).click();
  await page.screenshot({ path: `${shots}/archive-row-menu-dark.png` });
  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  await expect(page.getByRole("dialog", { name: `Delete ${address}` })).toBeVisible();
  await page.screenshot({ path: `${shots}/archive-delete-dialog-dark.png` });
  await setTheme(page, "light");
  await page.getByRole("button", { name: `Actions for ${address}` }).click();
  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  await page.screenshot({ path: `${shots}/archive-delete-dialog-light.png` });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: `Actions for ${address}` }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByRole("heading", { name: address })).toHaveCount(0);
  await page.getByRole("link", { name: "Archived" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await page.screenshot({ path: `${shots}/archive-filter-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/archive-filter-dark.png`, fullPage: true });
  await page.getByRole("button", { name: `Actions for ${address}` }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await page.goto("/admin/listings");
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
});

test("an unpaid listing and its photo file can be deleted", async ({ page }) => {
  const address = `${Date.now()} Delete Lane`;
  const before = new Set(walk(mediaRoot));
  await signIn(page, "eathen@amalfimedia.xyz");
  await page.goto("/admin/crm/leads");
  await page.getByRole("link", { name: "Jordan Hale" }).click();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await page.getByRole("link", { name: "Add listing" }).click();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32810");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { level: 1, name: address })).toBeVisible();
  const listingUrl = page.url();
  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: "gone.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: "gone.png", exact: true })).toBeVisible({ timeout: 20_000 });
  const created = walk(mediaRoot).filter((file) => !before.has(file));
  expect(created.length).toBeGreaterThan(0);
  await page.goto("/admin/listings");
  await page.getByRole("button", { name: `Actions for ${address}` }).click();
  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  await page.getByLabel("Type the name to confirm").fill(address);
  await page.getByRole("dialog", { name: `Delete ${address}` }).getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible();
  const missing = await page.goto(listingUrl);
  expect(missing?.status()).toBe(404);
  for (const file of created) expect(existsSync(file)).toBe(false);
});

test("a paid order cannot be permanently deleted", async ({ page }) => {
  await signIn(page, "eathen@amalfimedia.xyz");
  await page.goto("/admin/orders");
  const paid = page.getByTestId("order-row").filter({ hasText: "Delivered" }).first();
  await paid.getByRole("button", { name: /^Actions for Order/ }).click();
  await expect(paid.getByRole("menuitem", { name: "Delete permanently" })).toHaveCount(0);
  await expect(paid.getByRole("menuitem", { name: "Archive" })).toBeVisible();
});

test("staff cannot see permanent delete", async ({ page }) => {
  await signIn(page, "staff.demo@amalfimedia.xyz");
  await page.goto("/admin/listings");
  await page.getByRole("button", { name: "Actions for 1842 Lake Conway Shore" }).click();
  await expect(page.getByRole("menuitem", { name: "Delete permanently" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Archive" })).toBeVisible();
});
