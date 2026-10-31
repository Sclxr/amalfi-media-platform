import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const shots = "/opt/cursor/artifacts/screenshots";

test("a portal gallery shows a tiled watermark on a bright photo", async ({ page, browser }) => {
  mkdirSync(shots, { recursive: true });
  const address = `${Date.now()} Bright House`;
  const bright = await sharp({
    create: { width: 1400, height: 900, channels: 3, background: { r: 186, g: 214, b: 236 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 900, height: 520, channels: 3, background: { r: 245, g: 245, b: 242 } },
        })
          .png()
          .toBuffer(),
        left: 250,
        top: 220,
      },
    ])
    .png()
    .toBuffer();

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
  await page.getByLabel("ZIP").fill("32806");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: bright });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: "front.png", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published for the client.").first()).toBeVisible();

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/portal/login");
  await guestPage.getByRole("button", { name: "Use password instead" }).click();
  await guestPage.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await guestPage.getByLabel("Password").fill(password);
  await guestPage.getByRole("button", { name: "Sign in" }).click();
  await expect(guestPage.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
  await guestPage.goto("/portal/galleries");
  await guestPage.getByRole("link", { name: address }).click();
  await expect(guestPage.getByRole("heading", { name: address })).toBeVisible();
  const image = guestPage.getByRole("img", { name: "front.png" });
  await expect(image).toBeVisible();
  const preview = await guestPage.request.get((await image.getAttribute("src")) ?? "");
  expect(preview.status()).toBe(200);
  expect(preview.headers()["x-preview-watermark"]).toBe("true");
  expect(preview.headers()["content-type"]).toContain("image/jpeg");
  await guestPage.screenshot({ path: `${shots}/watermark-gallery-light.png`, fullPage: true });
  await guestPage.evaluate((value) => localStorage.setItem("theme", value), "dark");
  await guestPage.reload();
  await expect(guestPage.locator("html")).toHaveClass(/dark/);
  await guestPage.screenshot({ path: `${shots}/watermark-gallery-dark.png`, fullPage: true });
  await guest.close();
});
