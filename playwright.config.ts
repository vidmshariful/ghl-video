import { defineConfig, devices } from "@playwright/test";

/*
 * Read-only smoke suite over the marketing pages. Reuses a dev server
 * already running on :3000 (the usual state on this machine) or starts one.
 * Checkout pages are deliberately not visited: /checkout/[sku] creates a
 * real PaymentIntent on load, and a smoke run must never write anywhere.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  /* a dev server compiles pages on first hit; too many parallel first hits
     time out, so cap the workers and give expects headroom */
  workers: 4,
  retries: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
