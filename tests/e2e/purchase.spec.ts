import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";
const webhookSecret = "whsec_e2e_amalfi_playwright_secret";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_dev";
const shots = "/opt/cursor/artifacts/screenshots";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function sql(query: string) {
  return execFileSync("psql", [databaseUrl, "-tA", "-c", query], { encoding: "utf8" }).trim();
}

function sign(payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function postWebhook(request: APIRequestContext, event: unknown) {
  const payload = JSON.stringify(event);
  const response = await request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "stripe-signature": sign(payload), "content-type": "application/json" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

function paidEvent(id: string, invoiceId: string, sessionId: string, amount: number, currency = "usd") {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        amount_total: amount,
        currency,
        payment_status: "paid",
        metadata: { invoiceId },
        payment_intent: { id: `pi_${id}`, latest_charge: { receipt_url: "https://pay.stripe.com/receipts/e2e" } },
      },
    },
  };
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

test("a new client claims a gallery, pays, and downloads", async ({ page, browser, request }) => {
  mkdirSync(shots, { recursive: true });
  const stamp = Date.now();
  const email = `buy-${stamp}@example.com`;
  const address = `${stamp} Purchase Road`;
  const clientPassword = "Invite-Claim-2026!";

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/crm/leads/new");
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Nguyen");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create realtor" }).click();
  await expect(page.getByRole("heading", { name: "Casey Nguyen" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Listings" }).click();
  await page.getByRole("link", { name: "Add listing" }).click();
  await page.getByLabel("Address").fill(address);
  await page.getByLabel("ZIP").fill("32801");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();

  await page.getByRole("tab", { name: "Gallery" }).click();
  await page.getByRole("button", { name: "Create an order for these photos" }).click();
  await page.getByRole("dialog", { name: "Create an order" }).getByRole("button", { name: "Create order" }).click();
  await page.getByLabel("Gallery file").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photos" }).click();
  await expect(page.getByRole("button", { name: "front.png", exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published for the client.").first()).toBeVisible();

  const previewMail = sql(`SELECT value->>'text' FROM "AppSetting" WHERE key = 'dev.lastTransactionalEmail'`);
  const inviteUrl = previewMail.match(/https?:\/\/\S+\/portal\/invite\?token=[^\s]+/)?.[0];
  expect(inviteUrl, previewMail).toBeTruthy();

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(inviteUrl!);
  await guestPage.getByRole("link", { name: "Create an account" }).click();
  await expect(guestPage).toHaveURL(/next=/);
  await guestPage.getByLabel("Name").fill("Casey Nguyen");
  await guestPage.getByLabel("Email").fill(email);
  await guestPage.getByLabel("Password").fill(clientPassword);
  await guestPage.getByRole("button", { name: "Create account" }).click();
  await expect(guestPage.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });
  const galleryUrl = guestPage.url().split("?")[0]!;
  const image = guestPage.getByRole("img", { name: "front.png" });
  const preview = await guestPage.request.get((await image.getAttribute("src")) ?? "");
  expect(preview.headers()["x-preview-watermark"]).toBe("true");
  expect(preview.headers()["content-type"]).toContain("image/jpeg");
  expect((await guestPage.request.get(`${galleryUrl}/download`)).status()).toBe(402);
  expect((await guestPage.request.get(`${galleryUrl}/zip`)).status()).toBe(402);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/portal/login");
  await otherPage.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await otherPage.getByLabel("Password").fill(password);
  await otherPage.getByRole("button", { name: "Sign in" }).click();
  await expect(otherPage.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
  expect((await otherPage.goto(galleryUrl))?.status()).toBe(404);
  await other.close();

  await page.getByRole("tab", { name: "Orders & Billing" }).click();
  await page.getByLabel(/^Package for order/).selectOption({ label: "Introductory photography · $120.00" });
  await page.getByRole("button", { name: "Use package" }).click();
  await expect(page.getByText("Price saved.")).toBeVisible();
  await page.getByRole("button", { name: "Create invoice" }).click();
  const voidedNumber = (await page.getByRole("link", { name: /INV-/ }).first().textContent())?.trim() ?? "";
  expect(voidedNumber).toMatch(/^INV-/);
  await page.getByRole("button", { name: "Void" }).click();
  await page.getByRole("dialog", { name: "Void invoice" }).getByRole("button", { name: "Void invoice" }).click();
  await expect(page.getByText("Invoice voided.")).toBeVisible();
  const voidedId = sql(`SELECT id FROM "Invoice" WHERE number = '${voidedNumber}'`);
  sql(`UPDATE "Invoice" SET "stripeCheckoutSessionId" = 'cs_void_${stamp}' WHERE id = '${voidedId}'`);
  const voidedTotal = Number(sql(`SELECT "totalCents" FROM "Invoice" WHERE id = '${voidedId}'`));
  const voided = await postWebhook(request, paidEvent(`evt_void_${stamp}`, voidedId, `cs_void_${stamp}`, voidedTotal));
  expect(voided.rejected).toBe(true);
  expect(sql(`SELECT status FROM "Invoice" WHERE id = '${voidedId}'`)).toBe("VOID");

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("link", { name: /INV-/ }).last()).toBeVisible();

  await guestPage.goto(galleryUrl);
  await expect(guestPage.getByRole("link", { name: /Invoice INV-/ })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Buy" })).toBeVisible();
  await guestPage.screenshot({ path: `${shots}/gallery-buy-light.png`, fullPage: true });
  await setTheme(guestPage, "dark");
  await expect(guestPage.getByRole("button", { name: "Buy" })).toBeVisible();
  await guestPage.screenshot({ path: `${shots}/gallery-buy-dark.png`, fullPage: true });
  await setTheme(guestPage, "light");
  await guestPage.getByRole("button", { name: "Buy" }).click();
  await expect(guestPage.getByText("Payment is processing.")).toBeVisible();

  const openRow = sql(
    `SELECT id || '|' || "stripeCheckoutSessionId" || '|' || "totalCents" FROM "Invoice" WHERE status = 'OPEN' AND "clientId" = (SELECT id FROM "Client" WHERE email = '${email}') ORDER BY "createdAt" DESC LIMIT 1`,
  );
  const [invoiceId, sessionId, totalText] = openRow.split("|");
  const total = Number(totalText);
  expect(sessionId.startsWith("cs_")).toBeTruthy();
  const short = await postWebhook(request, paidEvent(`evt_short_${stamp}`, invoiceId!, sessionId!, 100));
  expect(short.rejected).toBe(true);
  const wrongCurrency = await postWebhook(request, paidEvent(`evt_eur_${stamp}`, invoiceId!, sessionId!, total, "eur"));
  expect(wrongCurrency.rejected).toBe(true);
  expect(sql(`SELECT status FROM "Invoice" WHERE id = '${invoiceId}'`)).toBe("OPEN");
  await guestPage.reload();
  await expect(guestPage.getByText("Payment required before download.")).toBeVisible();

  const paid = await postWebhook(request, paidEvent(`evt_paid_${stamp}`, invoiceId!, sessionId!, total));
  expect(paid.paid).toBe(true);
  await guestPage.goto(`${galleryUrl}?paid=1`);
  await expect(guestPage.getByText("Payment received. You can download these photos.")).toBeVisible();
  await guestPage.screenshot({ path: `${shots}/gallery-paid-light.png`, fullPage: true });
  const download = await guestPage.request.get(`${galleryUrl}/download`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("application/zip");
  const receipt = sql(`SELECT value->>'subject' FROM "AppSetting" WHERE key = 'dev.lastTransactionalEmail'`);
  expect(receipt).toContain("Receipt for");

  const refunded = await postWebhook(request, {
    id: `evt_refund_${stamp}`,
    type: "charge.refunded",
    data: { object: { id: `ch_${stamp}`, amount: total, amount_refunded: total, currency: "usd", metadata: { invoiceId } } },
  });
  expect(refunded.refunded).toBe(true);
  await guestPage.reload();
  await expect(guestPage.getByText("Payment required before download.")).toBeVisible();
  expect((await guestPage.request.get(`${galleryUrl}/download`)).status()).toBe(402);
  expect((await guestPage.request.get(`${galleryUrl}/zip`)).status()).toBe(402);
  await guest.close();
});
