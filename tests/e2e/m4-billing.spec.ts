import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const shots = "/opt/cursor/artifacts/screenshots";

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("a gallery preview is watermarked and download stays locked until payment", async ({ page }) => {
  const photoName = `paid-check-${Date.now()}.png`;
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/billing");
  await expect(page.getByText("Checkout uses Stripe. Card numbers stay at Stripe.")).toBeVisible();
  await expect(page.getByRole("link", { name: "INV-2026-0001" })).toBeVisible();

  await page.goto("/admin/listings");
  await page.getByRole("link", { name: /1842 Lake Conway Shore/ }).click();
  await expect(page.getByRole("heading", { name: "1842 Lake Conway Shore" })).toBeVisible();
  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: photoName, mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: photoName, exact: true })).toBeVisible({ timeout: 20_000 });
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  if ((await publish.count()) > 0) await publish.first().click();
  await expect(page.getByText("Published for the client.").first()).toBeVisible();

  await page.goto("/portal/login");
  await page.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
  await page.goto("/portal/galleries");
  await page.getByRole("link", { name: "1842 Lake Conway Shore" }).first().click();
  const image = page.getByRole("img", { name: photoName }).first();
  await expect(image).toBeVisible();
  const src = await image.getAttribute("src");
  const preview = await page.request.get(src ?? "");
  expect(preview.ok()).toBeTruthy();
  expect(preview.headers()["x-preview-watermark"]).toBe("true");
  expect(preview.headers()["content-type"]).toContain("image/jpeg");
  expect(preview.headers()["x-media-token"]).toBeUndefined();
  mkdirSync(shots, { recursive: true });
  await setTheme(page, "light");
  await page.screenshot({ path: `${shots}/watermark-preview-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/watermark-preview-dark.png`, fullPage: true });
  await expect(page.getByText("Payment required before download.")).toBeVisible();
  const download = await page.request.get(`${page.url().replace(/\/$/, "")}/download`);
  expect(download.status()).toBe(402);
});
