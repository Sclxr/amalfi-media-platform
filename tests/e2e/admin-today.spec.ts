import { expect, test } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";

test("today shows the jobs and the seed listing that still needs photos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New shoot" }).first()).toHaveAttribute("href", "/admin/listings/new");
  await expect(page.getByRole("link", { name: "Send quote" })).toHaveAttribute("href", /tab=billing/);
  await expect(page.getByRole("link", { name: "Upload photos" })).toHaveAttribute("href", /tab=gallery/);
  await expect(page.getByRole("heading", { name: "Upcoming shoots" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unpaid" })).toBeVisible();
  const galleries = page.getByRole("region", { name: "Galleries to send" });
  await expect(galleries.getByRole("link", { name: /1842 Lake Conway Shore/ })).toBeVisible();
  await expect(galleries.getByText("No photos yet").first()).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Today", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Shoots" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Listings" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Money" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Realtors", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();

  await page.goto("/admin/listings/seed-property-hale");
  await expect(page.getByRole("heading", { name: "1842 Lake Conway Shore" })).toBeVisible();
  await expect(page.locator("header")).toContainText("1842 Lake Conway Shore");
  await expect(page.locator("header")).not.toContainText("seed-property-hale");

  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const pastTheEdge = await page.evaluate(() => {
      const edge = document.documentElement.clientWidth;
      return [...document.querySelectorAll("main a, main p, main span")].some((el) => el.getBoundingClientRect().right > edge + 1);
    });
    expect(pastTheEdge).toBe(false);
  }
  const mobile = page.getByRole("navigation", { name: "Admin mobile" });
  await expect(mobile.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(mobile.getByRole("link", { name: "Shoots" })).toBeVisible();
  await expect(mobile.getByRole("link", { name: "Money" })).toBeVisible();
  await mobile.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Realtors", exact: true })).toBeVisible();
});
