import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const shots = "/opt/cursor/artifacts/screenshots";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";

test("admin can sign in and use CRM", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await expect(page.getByTestId("revenue-card")).toContainText("$120.00");

  await page.goto("/admin/crm/leads");
  await expect(page.getByRole("link", { name: "Maya Ellison" })).toBeVisible();
  await page.getByRole("link", { name: "Add realtor" }).click();
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Nguyen");
  await page.getByLabel("Email").fill("casey.nguyen@example.com");
  await page.getByLabel("City").fill("Orlando");
  await page.getByRole("button", { name: "Create realtor" }).click();
  await expect(page.getByRole("heading", { name: "Casey Nguyen" })).toBeVisible();
  await page.getByLabel("Add a note").fill("Asked about the introductory package.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Asked about the introductory package.").first()).toBeVisible();
});

test("duplicate email opens the existing realtor", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await page.goto("/admin/crm/leads/new");
  await page.getByLabel("First name").fill("Maya");
  await page.getByLabel("Last name").fill("Copy");
  await page.getByLabel("Email").fill("MAYA.ELLISON@example.com");
  await page.getByRole("button", { name: "Create realtor" }).click();
  await expect(page.getByText("already on file")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Maya Ellison" })).toBeVisible();
});

test("staff cannot see revenue or the catalog", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("staff.demo@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await expect(page.getByTestId("revenue-card")).toHaveCount(0);
  const response = await page.goto("/admin/settings/catalog");
  expect(response?.status()).toBe(404);
});

test("a client session gets 404 on admin", async ({ page }) => {
  await page.goto("/portal/login");
  await expect(page.getByTestId("portal-login")).toBeVisible();
  await page.getByLabel("Email").fill("client.demo@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});

async function setTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.reload();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
  else await expect(page.locator("html")).not.toHaveClass(/dark/);
}

test("screenshots of overview, CRM, and portal login", async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await page.goto("/portal/login");
  await setTheme(page, "light");
  await expect(page.getByRole("heading", { name: "Client portal" })).toBeVisible();
  await page.screenshot({ path: `${shots}/portal-login-light.png`, fullPage: true });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${shots}/portal-login-dark.png`, fullPage: true });

  await page.goto("/admin/login");
  await setTheme(page, "light");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();
  await page.screenshot({ path: `${shots}/admin-overview-light.png`, fullPage: true });
  await page.goto("/admin/crm/leads");
  await expect(page.getByRole("link", { name: "Maya Ellison" })).toBeVisible();
  await page.screenshot({ path: `${shots}/admin-crm-light.png`, fullPage: true });

  await setTheme(page, "dark");
  await expect(page.getByRole("link", { name: "Maya Ellison" })).toBeVisible();
  await page.screenshot({ path: `${shots}/admin-crm-dark.png`, fullPage: true });
  await page.goto("/admin");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByTestId("overview")).toBeVisible();
  await page.screenshot({ path: `${shots}/admin-overview-dark.png`, fullPage: true });
});

test("login page assets are root-relative", async ({ page }) => {
  const response = await page.goto("/admin/login");
  expect(response?.ok()).toBeTruthy();
  const hosted = await page.request.get("/admin/login", {
    headers: { host: "app.amalfimedia.xyz" },
  });
  expect(hosted.status()).toBe(200);
  const hostedHtml = await hosted.text();
  expect(hostedHtml).toContain('href="/admin');
  expect(hostedHtml).not.toContain("/_amalfi/");
  const html = await page.content();
  expect(html).not.toContain("/_amalfi/");
  const sources = await page.locator("script[src], link[rel='stylesheet'][href]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("src") ?? node.getAttribute("href")),
  );
  expect(sources.some((source) => source?.startsWith("/_next/"))).toBeTruthy();
});
