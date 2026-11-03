import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const shots = "/opt/cursor/artifacts/screenshots";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

test("Zelle stays locked until an admin marks it paid", async ({ page, browser }) => {
  test.setTimeout(60_000);
  mkdirSync(shots, { recursive: true });
  const address = `${Date.now()} Zelle Way`;
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
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  const listingUrl = page.url();

  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: "front.png", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published for the client.").first()).toBeVisible();

  await page.getByRole("tab", { name: "Orders & Billing" }).click();
  await page.getByLabel(/^Package for order/).selectOption({ label: "Introductory photography · $120.00" });
  await page.getByRole("button", { name: "Use package" }).click();
  await expect(page.getByText("Price saved.")).toBeVisible();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("link", { name: /INV-/ }).first()).toBeVisible();

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
  await expect(guestPage.getByText("Listing price $120.00")).toBeVisible();
  await expect(guestPage.getByText("Card processing fee $3.89")).toBeVisible();
  await expect(guestPage.getByText("Card total $123.89")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Buy" })).toBeVisible();
  await setTheme(guestPage, "light");
  await guestPage.screenshot({ path: `${shots}/zelle-choice-light.png`, fullPage: true });
  await guestPage.getByRole("button", { name: "Pay with Zelle, no card fee" }).click();
  await expect(guestPage.getByTestId("zelle-instructions")).toBeVisible();
  await expect(guestPage.getByText("(321) 246-6018")).toBeVisible();
  await expect(guestPage.getByText(address).nth(1)).toBeVisible();
  await guestPage.screenshot({ path: `${shots}/zelle-instructions-light.png`, fullPage: true });
  const galleryUrl = guestPage.url().split("?")[0]!;
  expect((await guestPage.request.get(`${galleryUrl}/download`)).status()).toBe(402);

  await page.goto(`${listingUrl.split("?")[0]}?tab=billing`);
  await expect(page.getByText("Awaiting Zelle")).toBeVisible();
  await page.getByRole("button", { name: "Mark paid (Zelle)" }).click();
  const dialog = page.getByRole("dialog", { name: "Mark paid (Zelle)" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/Zelle amount/)).toHaveValue("120.00");
  await page.screenshot({ path: `${shots}/zelle-mark-paid-light.png`, fullPage: true });
  await dialog.getByLabel(/Zelle note/).fill("text received");
  await dialog.getByRole("button", { name: "Confirm Zelle payment" }).click();
  await expect(page.getByText("Zelle payment recorded. Downloads are unlocked.")).toBeVisible();

  expect((await guestPage.request.get(`${galleryUrl}/download`)).status()).toBe(200);
  await guest.close();
});
