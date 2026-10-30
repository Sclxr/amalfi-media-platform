import { expect, test } from "@playwright/test";

const password = process.env.SEED_ADMIN_PASSWORD ?? "Amalfi-Demo-2026!";

test("admin imports a csv, sees the follow-up queue, and drafts a campaign", async ({ page }) => {
  const stamp = Date.now();
  const email = `riley.${stamp}@example.com`;
  const phone = `407${String(stamp).slice(-7)}`;
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("eathen@amalfimedia.xyz");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("overview")).toBeVisible();

  await page.goto("/admin/crm/import");
  await page.getByLabel("CSV").fill(
    ["First name,Last name,Email,Phone,Brokerage,City", `Riley,Stone,${email},${phone},Lakeside Realty,Orlando`, "Bad,Row,not-an-email,,,"].join("\n"),
  );
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByTestId("import-preview")).toContainText("1 to create");
  await expect(page.getByTestId("import-preview")).toContainText("not valid");
  await page.getByRole("button", { name: "Commit import" }).click();
  await expect(page.getByTestId("import-result")).toContainText("Created 1");

  await page.goto("/admin/crm/follow-ups");
  await expect(page.getByRole("link", { name: "Maya Ellison" })).toBeVisible();

  await page.goto("/admin/marketing");
  await expect(page.getByText("Marketing email is disabled outside production.")).toBeVisible();
  await page.getByRole("link", { name: "New campaign" }).click();
  await page.getByLabel("Name").fill(`Open house ${stamp}`);
  await page.getByLabel("Subject").fill("Introductory photos");
  await page.getByLabel("Body").fill("The $120 package is available in Orlando.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { name: `Open house ${stamp}` })).toBeVisible();
  await expect(page.getByText("Orlando, FL").first()).toBeVisible();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Marketing email is disabled outside production.")).toBeVisible();

  await page.goto("/admin/settings/api-keys");
  await page.getByLabel("Name").fill(`Bot ${stamp}`);
  await page.getByRole("button", { name: "Issue key" }).click();
  await expect(page.getByTestId("issued-key")).toContainText("amalfi_");
});
