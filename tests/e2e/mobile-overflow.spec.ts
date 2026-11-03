import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const viewports = [
  { name: "iphone", width: 390, height: 844 },
  { name: "android", width: 360, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("shell pages do not overflow on phone or desktop", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/admin/login");
    await expectNoOverflow(page);
  }

  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/admin");
    await expect(page.getByTestId("overview")).toBeVisible();
    await expectNoOverflow(page);
    await page.goto("/admin/listings");
    await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible();
    await expectNoOverflow(page);
  }

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/portal/login");
    await expectNoOverflow(page);
  }

  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("link", { name: "Gallery", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Galleries" })).toBeVisible();
    await expectNoOverflow(page);
  }
});
