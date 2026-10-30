import { expect, test } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("billing stays unconfigured and a gallery preview does not require payment", async ({ page }) => {
  const title = `Listing ${Date.now()}`;
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/billing");
  await expect(page.getByText("Stripe is not configured.")).toBeVisible();
  await expect(page.getByRole("link", { name: "INV-2026-0001" })).toBeVisible();

  await page.goto("/admin/media");
  const requested = page.locator("select[name=orderId] option", { hasText: "REQUESTED" }).first();
  const orderId = await requested.getAttribute("value");
  await page.locator("select[name=orderId]").selectOption(orderId ?? "");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create gallery" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByLabel("Gallery file").setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("preview.png")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published for the client.")).toBeVisible();

  await page.goto("/portal/login");
  await page.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
  await page.goto("/portal/galleries");
  await page.getByRole("link", { name: title }).click();
  const image = page.getByRole("img", { name: "preview.png" });
  await expect(image).toBeVisible();
  const src = await image.getAttribute("src");
  const preview = await page.request.get(src ?? "");
  expect(preview.ok()).toBeTruthy();
  expect(preview.headers()["x-preview-watermark"]).toBe("false");
  await expect(page.getByText("Payment required before download.")).toBeVisible();
  const download = await page.request.get(`${page.url().replace(/\/$/, "")}/download`);
  expect(download.status()).toBe(402);
});
