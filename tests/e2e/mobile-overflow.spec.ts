import { test } from "@playwright/test";
import { expectNoOverflow, phoneWidths } from "./overflow";

test("login pages do not overflow on phone or desktop", async ({ page }) => {
  for (const viewport of phoneWidths) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/admin/login");
    await expectNoOverflow(page);
    await page.goto("/portal/login");
    await expectNoOverflow(page);
  }
});
