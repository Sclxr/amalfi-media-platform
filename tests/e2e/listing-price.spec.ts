import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const shots = "/opt/cursor/artifacts/screenshots";

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

test("a listing order can take the intro package, a custom price, or line items", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  const address = `${Date.now()} Price Court`;
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/crm/leads");
  await page.getByRole("link", { name: "Jordan Hale" }).click();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await page.getByRole("link", { name: "Add listing" }).click();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();

  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText("No price yet.")).toHaveCount(0);

  await page.getByRole("tab", { name: "Orders & Billing" }).click();
  await expect(page.getByText("No price yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use package" })).toBeVisible();
  const viewports = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ] as const;
  for (const theme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setTheme(page, theme);
      await page.screenshot({ path: `${shots}/listing-price-${viewport.name}-${theme}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await setTheme(page, "light");

  await page.getByLabel(/^Package for order/).selectOption({ label: "Introductory photography · $120.00" });
  await page.getByRole("button", { name: "Use package" }).click();
  await expect(page.getByText("Price saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /\$120\.00/ })).toBeVisible();
  await expect(page.getByText("Introductory photography").first()).toBeVisible();
  await page.screenshot({ path: `${shots}/listing-price-package-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/listing-price-package-dark.png`, fullPage: true });
  await setTheme(page, "light");

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("link", { name: /INV-/ }).first()).toBeVisible();
  await expect(page.getByText("Void the open invoice before changing the price.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use package" })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/listing-price-invoice-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/listing-price-invoice-dark.png`, fullPage: true });
  await setTheme(page, "light");

  await page.getByRole("button", { name: "Void" }).click();
  await page.getByRole("dialog", { name: "Void invoice" }).getByRole("button", { name: "Void invoice" }).click();
  await expect(page.getByText("Invoice voided.")).toBeVisible();
  await page.getByLabel(/^Custom description for order/).fill("Twilight shoot");
  await page.getByLabel(/^Custom price for order/).fill("80.00");
  await page.getByRole("button", { name: "Save custom price" }).click();
  await expect(page.getByRole("heading", { name: /\$80\.00/ })).toBeVisible();
  await expect(page.getByText("Twilight shoot")).toBeVisible();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("link", { name: /INV-/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Void" }).click();
  await page.getByRole("dialog", { name: "Void invoice" }).getByRole("button", { name: "Void invoice" }).click();
  await expect(page.getByText("Invoice voided.")).toBeVisible();

  await page.getByLabel(/^Line 1 description for order/).fill("Photos");
  await page.getByLabel(/^Line 1 quantity for order/).fill("1");
  await page.getByLabel(/^Line 1 amount for order/).fill("100.00");
  await page.getByLabel(/^Line 2 description for order/).fill("Drone");
  await page.getByLabel(/^Line 2 amount for order/).fill("40");
  await page.getByRole("button", { name: "Save line items" }).click();
  await expect(page.getByRole("heading", { name: /\$140\.00/ })).toBeVisible();
  await expect(page.getByText("Photos · $100.00")).toBeVisible();
  await expect(page.getByText("Drone · $40.00")).toBeVisible();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("link", { name: /INV-/ }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save line items" })).toHaveCount(0);
});
