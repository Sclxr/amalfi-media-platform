import { expect, test } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";

test("a realtor can request a shoot and an admin can quote it", async ({ page }) => {
  const stamp = Date.now();
  const address = `${stamp} Oak Street`;
  await page.goto("/portal/login");
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();

  await page.goto("/portal/book");
  await page.getByLabel("Property address").fill(address);
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("checkbox", { name: /Drone stills/ }).check();
  await page.getByLabel("Preferred date").fill("2026-11-03");
  await page.getByRole("button", { name: "Request booking" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await expect(page.getByText("travel $0.00")).toBeVisible();
  await expect(page.getByText("Drone stills · quote")).toBeVisible();
  const calendar = await page.request.get(page.url().replace(/\/$/, "") + "/calendar");
  expect(calendar.ok()).toBeTruthy();
  expect(await calendar.text()).toContain("BEGIN:VCALENDAR");

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: address }).click();
  await page.getByLabel("Price for Drone stills").fill("150.00");
  await page.getByRole("button", { name: "Save quote" }).click();
  await page.getByRole("button", { name: "Mark Quoted" }).click();
  await expect(page.getByText("Requested → Quoted")).toBeVisible();

  await page.goto("/admin/bookings/availability");
  await expect(page.getByText("Monday 09:00–17:00")).toBeVisible();
  await page.goto("/admin/orders/email");
  await expect(page.getByText("development only previews transactional email.")).toBeVisible();
  await expect(page.getByText("1842 Lake Conway Shore, Orlando, FL").first()).toBeVisible();
});
