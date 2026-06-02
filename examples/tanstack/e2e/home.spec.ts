import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the anonymous login experience", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Better Auth \+ Paystack SDK/i })).toBeVisible();
    await expect(page.getByText("Anonymous Login")).toBeVisible();
    await expect(page.getByText("Secure Checkout")).toBeVisible();
  });

  test("should have anonymous sign in when not authenticated", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Login Anonymously" })).toBeVisible();
  });
});

test.describe("Authentication Flow", () => {
  test("should sign in as guest and navigate to dashboard", async ({ page }) => {
    await page.goto("/");

    // Click guest sign in
    const signInButton = page.getByRole("button", {
      name: "Login Anonymously",
    });
    await signInButton.click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });

    // Should show dashboard content
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("should sign out and return to home", async ({ page }) => {
    // First sign in
    await page.goto("/");
    await page.getByRole("button", { name: "Login Anonymously" }).click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15_000 });

    // Then sign out
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Should return to home without session
    await expect(page.getByRole("button", { name: "Login Anonymously" })).toBeVisible();
  });
});
