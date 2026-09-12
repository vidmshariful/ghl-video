import { test, expect } from "@playwright/test";
import { env, signIn, staging, watchConsole } from "./helpers";

/*
 * The walkthrough: sign in as the studio and as a client on staging and use
 * the screens the way a person does. Read-only in this first cut; the
 * per-line walkthroughs of phase 1 add the writes.
 *
 * Skips itself when the QA logins are not in .env.local (a machine without
 * staging), so the smoke suite still runs everywhere. Never points at
 * production: the logins only exist on staging.
 */
const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const client = { email: env.QA_CLIENT_EMAIL ?? "", password: env.QA_CLIENT_PASSWORD ?? "" };

test.describe.configure({ mode: "serial" });

test.describe("studio, on staging", () => {
  test.skip(!staging || !admin.password, "needs the staging QA admin in .env.local");

  test("signs in, reads the client list, opens a record on every tab", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/admin/", admin, /dashboard/i);

    await page.goto("/admin/customers/");
    await expect(page.getByRole("heading", { name: /clients/i })).toBeVisible();
    await page.getByText("HighLevel Inc.").first().click();
    await expect(page.getByRole("heading", { name: "HighLevel Inc." })).toBeVisible();
    for (const tab of ["Custom", "Billing", "Portal", "Overview"]) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toHaveAttribute("aria-selected", "true");
    }
    /* back on Overview: the partnership month card names the month */
    await expect(page.getByText(/^Partnership, /).first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the premade board lists premade work only", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/admin/", admin, /dashboard/i);
    await page.goto("/admin/production/");
    await expect(page.getByRole("heading", { name: /premade/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/need the studio|nothing needs/i).first()).toBeVisible();
    await expect(page.getByText("HighLevel Inc.")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the editing board opens a client by its handle", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/admin/", admin, /dashboard/i);
    await page.goto("/admin/editing/extendly/");
    await expect(page.getByText(/month of|credits/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /their record/i })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("a client, on staging", () => {
  test.skip(!staging || !client.password, "needs the staging demo client in .env.local");

  test("signs in and every section the account has renders", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/portal/", client, /welcome back/i);
    for (const [path, text] of [
      ["/portal/videos/", /pre-made/i],
      ["/portal/projects/", /custom/i],
      ["/portal/subscriptions/", /editing/i],
      ["/portal/orders/", /billing/i],
      ["/portal/brand/", /brand/i],
      ["/portal/messages/", /messages/i],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: text }).first()).toBeVisible();
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
