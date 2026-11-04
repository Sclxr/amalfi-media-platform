import { expect, type Page } from "@playwright/test";

export const phoneWidths = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 1440, height: 900 },
] as const;

export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
