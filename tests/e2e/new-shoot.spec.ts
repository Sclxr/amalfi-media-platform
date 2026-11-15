import { expect, test } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";

test("new shoot is one save, and an empty form explains what is missing", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.goto("/admin/bookings/new");
  await expect(page.getByRole("heading", { name: "New shoot" })).toBeVisible();
  await page.getByRole("button", { name: "Save shoot" }).click();
  await expect(page.getByText("Choose a realtor, or add a new one.")).toBeVisible();
  await expect(page.getByText("Enter the street address.")).toBeVisible();

  const stamp = Date.now();
  await page.getByRole("button", { name: "Add new realtor" }).click();
  await page.getByLabel("First name").fill("Riley");
  await page.getByLabel("Last name").fill("Cho");
  await page.getByLabel("Email").fill(`riley-${stamp}@example.com`);
  await page.getByLabel("Street address").fill(`${stamp} New Shoot Ave`);
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("button", { name: "Save shoot" }).click();
  await expect(page.getByTestId("shoot-booked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy invite link" })).toBeVisible();
  await expect(page.getByTestId("shoot-booked").getByRole("link", { name: "Upload photos" })).toBeVisible();
  await expect(page.getByText("Nothing was emailed.")).toBeVisible();
});
