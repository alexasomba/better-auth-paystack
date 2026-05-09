import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined && process.env.CI !== null && process.env.CI !== "",
  retries: process.env.CI !== undefined && process.env.CI !== null && process.env.CI !== "" ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1"
      ? undefined
      : {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer:
            process.env.CI === undefined || process.env.CI === null || process.env.CI === "",
        },
});
