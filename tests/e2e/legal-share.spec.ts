import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoOverflow, phoneWidths } from "./overflow";

const shots = "/opt/cursor/artifacts/screenshots/legal";

test("terms and privacy are public and do not overflow", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  for (const path of ["/terms", "/privacy"] as const) {
    for (const viewport of phoneWidths) {
      await page.setViewportSize(viewport);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByText("Last updated November 5, 2026")).toBeVisible();
      await expect(page.getByText(/lawyer can review/i)).toBeVisible();
      await expectNoOverflow(page);
      if (viewport.width === 390 || viewport.width === 1440) {
        const name = path.slice(1);
        const size = viewport.width === 390 ? "iphone" : "desktop";
        await page.screenshot({ path: `${shots}/${name}-${size}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portal/login");
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
});

test("shared pages advertise an Amalfi title, description, and image", async ({ page }) => {
  for (const [path, title] of [
    ["/", "Amalfi Media"],
    ["/terms", "Terms · Amalfi Media"],
    ["/portal/invite", "Gallery invite · Amalfi Media"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
    const description = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(description && description.length > 20).toBeTruthy();
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toBeTruthy();
    const icon = page.locator('link[rel="icon"]');
    expect(await icon.count()).toBeGreaterThan(0);
    if (path === "/") {
      const response = await page.request.get(image!);
      expect(response.ok()).toBeTruthy();
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  }
});
