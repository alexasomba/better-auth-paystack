import { expect, test, type Page } from "@playwright/test";

async function signInAnonymously(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Login Anonymously" }).click();
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)} ${Math.random().toString(36).slice(2, 7)}`;
}

async function createOrganization(page: Page, name = uniqueName("Acme Test Co")) {
  await page.getByRole("tab", { name: "Organizations" }).click();
  await page.getByRole("button", { name: "New Organization" }).click();
  await page.getByLabel("Organization Name *").fill(name);
  await page.getByRole("button", { name: "Create Organization" }).click();

  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByText(`/${name.toLowerCase().replaceAll(" ", "-")}`)).toBeVisible();
  await expect(page.getByText(/^referenceId:/)).toBeVisible();

  return name;
}

test.describe("TanStack example dashboard flows", () => {
  test.describe.configure({ mode: "serial" });

  test("covers organizations, billing tabs, checkout initialization, and callback states", async ({
    page,
  }) => {
    await signInAnonymously(page);
    const organizationName = await createOrganization(page);

    await expect(page.getByText("Organization Billing")).toBeVisible();
    await expect(page.getByText("Owners and admins can manage billing")).toBeVisible();

    await page.getByRole("tab", { name: "Subscriptions" }).click();
    await expect(page.getByText("Subscription Plans")).toBeVisible();
    await expect(page.getByText("Better Auth Config Plans")).toBeVisible();
    await expect(page.getByText("Trusted Server Operations")).toBeVisible();

    let subscriptionInitializePayload: unknown;
    await page.route("**/api/auth/paystack/initialize-transaction", async (route) => {
      subscriptionInitializePayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          reference: "e2e_subscribe",
          accessCode: "access_e2e",
          redirect: false,
        }),
      });
    });

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: organizationName }).click();
    await page.getByLabel("Number of Seats").fill("5");
    await page
      .getByRole("button", { name: /Subscribe Now|Start \d+-Day Trial/ })
      .first()
      .click();

    await expect
      .poll(() => subscriptionInitializePayload)
      .toMatchObject({
        callbackURL: "http://localhost:3000/billing/paystack/callback",
        quantity: 5,
      });

    await page.getByRole("tab", { name: "One-Time" }).click();
    await expect(page.getByText("One-Time Payments")).toBeVisible();
    await expect(page.getByText("Better Auth Config Products")).toBeVisible();
    await expect(page.getByText("Paystack->DB Synced Products")).toBeVisible();

    let productInitializePayload: unknown;
    await page.unroute("**/api/auth/paystack/initialize-transaction");
    await page.route("**/api/auth/paystack/initialize-transaction", async (route) => {
      productInitializePayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          reference: "e2e_product",
          accessCode: "access_e2e",
          redirect: false,
        }),
      });
    });

    await page
      .getByRole("button", { name: /Buy Now|Purchase/ })
      .first()
      .click();

    await expect
      .poll(() => productInitializePayload)
      .toMatchObject({
        callbackURL: "http://localhost:3000/billing/paystack/callback",
      });
    expect(productInitializePayload).toEqual(
      expect.objectContaining({ product: expect.any(String) }),
    );

    await page.getByRole("tab", { name: "Transactions" }).click();
    await expect(page.getByText("Transaction History")).toBeVisible();
    await expect(page.getByText("Reference")).toBeVisible();
    await expect(page.getByText("Billed To")).toBeVisible();

    await page.goto("/billing/paystack/callback");

    await expect(page.getByText("No reference provided.")).toBeVisible();
  });
});
