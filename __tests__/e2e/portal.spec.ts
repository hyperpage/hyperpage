import { test, expect } from "@playwright/test";

const shouldRunE2ESuite = process.env.E2E_TESTS === "1";
const describeE2E = shouldRunE2ESuite ? test.describe : test.describe.skip;

describeE2E("Hyperpage Portal Empty State E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Hyperpage/);
  });

  test("shows the No Tools Enabled message by default", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "No Tools Enabled" })).toBeVisible();
    await expect(
      page.getByText(
        /Enable tools in your environment configuration to see portal widgets/i,
      ),
    ).toBeVisible();
  });

  test("instructs users to configure integrations via the settings dropdown", async ({
    page,
  }) => {
    await expect(
      page.getByText(/Configure integrations using the settings dropdown/i),
    ).toBeVisible();
  });

  test("remains stable across reloads", async ({ page }) => {
    await page.reload();
    await expect(page.getByRole("heading", { name: "No Tools Enabled" })).toBeVisible();
  });
});
