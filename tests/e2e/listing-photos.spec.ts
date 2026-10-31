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

test("a new listing accepts a photo, opens it, and publishes it", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  const address = `${Date.now()} Citrus Lane`;
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Media" })).toHaveCount(0);

  await page.goto("/admin/crm/leads");
  await page.getByRole("link", { name: "Jordan Hale" }).click();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await page.getByRole("link", { name: "Add listing" }).click();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32803");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await expect(page.getByLabel("Street")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit listing" }).click();
  await expect(page.getByRole("dialog", { name: "Edit listing" }).getByLabel("Street")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: "front.png", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "front.png", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Photo" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published for the client.")).toBeVisible();
  await page.getByRole("link", { name: "Preview as client" }).click();
  await expect(page.getByText("Payment required before download.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toHaveCount(0);
  await page.goBack();

  const tabs = ["overview", "gallery", "bookings", "billing"] as const;
  const viewports = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ] as const;
  for (const tab of tabs) {
    await page.getByRole("tab", { name: tab === "billing" ? "Orders & Billing" : tab[0]!.toUpperCase() + tab.slice(1) }).click();
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.screenshot({ path: `${shots}/listing-${tab}-${viewport.name}-${theme}.png`, fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await setTheme(page, "light");
  await page.screenshot({ path: `${shots}/listing-photos-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/listing-photos-dark.png`, fullPage: true });
});

test("a listing accepts a photo larger than the 1 MB server-action limit", async ({ page }) => {
  const name = `wide-${Date.now()}.png`;
  // Larger than Next's default 10 MB proxy body clone, so a truncated save fails this check.
  const bytes = Buffer.alloc(12 * 1024 * 1024, 7);
  expect(bytes.byteLength).toBeGreaterThan(10 * 1024 * 1024);
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await page.goto("/admin/listings/seed-property-hale?tab=gallery");
  await expect(page.getByRole("heading", { level: 1, name: "1842 Lake Conway Shore" })).toBeVisible();
  await page.getByLabel("Gallery file").setInputFiles({ name, mimeType: "image/png", buffer: bytes });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible({ timeout: 30_000 });
  const src = await page.getByRole("img", { name, exact: true }).getAttribute("src");
  const saved = await page.request.get(src ?? "");
  expect(saved.ok()).toBeTruthy();
  expect((await saved.body()).byteLength).toBe(bytes.byteLength);
});
