import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/*
 * The walkthrough: sign in as the studio and as a client on staging and use
 * the screens the way a person does. Read-only in this first cut; the
 * per-line walkthroughs of phase 1 add the writes.
 *
 * Skips itself when the QA logins are not in .env.local (a machine without
 * staging), so the smoke suite still runs everywhere. Never points at
 * production: the logins only exist on staging.
 */
const env: Record<string, string> = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no env file: every test below skips */
}
const staging = env.GHLV_ENV === "staging";
const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const client = { email: env.QA_CLIENT_EMAIL ?? "", password: env.QA_CLIENT_PASSWORD ?? "" };

const ALLOWED_ERRORS = [/mode="md"/, /Download the React DevTools/];
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ALLOWED_ERRORS.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function signIn(
  page: Page,
  path: string,
  who: { email: string; password: string },
  signedIn: RegExp,
) {
  await page.goto(path);
  /* The form's submit handler is attached on hydration; a click before that
     is a native submit, which reloads the login page and looks like a wrong
     password. On a dev server hydration lands seconds after paint, so wait
     for the network to settle and try again if the form is still there. */
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => null);
  const button = page.getByRole("button", { name: /^sign in$/i }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole("textbox", { name: /email/i }).first().fill(who.email);
    await page.locator('input[type="password"]').first().fill(who.password);
    await button.click();
    /* signed in means the signed-in screen is up, not merely that the form
       went away: a native submit before hydration also reloads the form */
    const ok = await page
      .getByRole("heading", { name: signedIn })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
    await page.waitForTimeout(1500);
  }
  throw new Error(`could not sign in as ${who.email}: the sign-in form stayed`);
}

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
