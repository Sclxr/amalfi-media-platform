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

test("admin creates a listing from a realtor and finds it everywhere", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  const stamp = Date.now();
  const address = `${stamp} Palm Drive`;

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/listings");
  await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1842 Lake Conway Shore" })).toBeVisible();
  await expect(page.getByText("Jordan Hale").first()).toBeVisible();
  await page.getByLabel("Search listings").fill("Jordan");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1842 Lake Conway Shore" })).toBeVisible();
  await setTheme(page, "light");
  await page.screenshot({ path: `${shots}/listings-grid-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/listings-grid-dark.png`, fullPage: true });
  await setTheme(page, "light");

  await expect(page.getByRole("link", { name: /1842 Lake Conway Shore/ }).first()).toBeVisible();
  await page.getByRole("heading", { name: "1842 Lake Conway Shore" }).click();
  await expect(page).toHaveURL(/\/admin\/listings\/seed-property-hale/);
  await expect(page.getByRole("main").getByRole("link", { name: "Jordan Hale" })).toBeVisible();
  await expect(page.getByRole("link", { name: "INV-2026-0001" })).toBeVisible();
  await page.screenshot({ path: `${shots}/listing-detail-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/listing-detail-dark.png`, fullPage: true });
  await setTheme(page, "light");

  await page.getByRole("link", { name: "Jordan Hale" }).click();
  await expect(page.getByRole("heading", { name: "Jordan Hale" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await expect(page.getByText("1842 Lake Conway Shore")).toBeVisible();
  await page.screenshot({ path: `${shots}/realtor-listings-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/realtor-listings-dark.png`, fullPage: true });
  await setTheme(page, "light");

  await page.getByRole("link", { name: "Add listing" }).click();
  await expect(page.getByText("Realtor: Jordan Hale")).toBeVisible();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await expect(page.getByRole("link", { name: "Jordan Hale" })).toBeVisible();

  await page.goto("/admin/listings");
  await page.getByLabel("Search listings").fill(address);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await page.getByLabel("Status").selectOption("NO_SHOOT");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1842 Lake Conway Shore" })).toHaveCount(0);
});
