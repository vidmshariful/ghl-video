import { test, expect, type Page } from "@playwright/test";

/*
 * Read-only smoke: every marketing page renders, carries its chrome, and
 * throws no console errors. No checkout page is visited (loading one
 * creates a real PaymentIntent) and nothing is submitted.
 */

const PAGES: { path: string; h1?: RegExp }[] = [
  { path: "/" },
  { path: "/premade/" },
  { path: "/custom-video/" },
  { path: "/editing/" },
  { path: "/quote/" },
  { path: "/about/" },
  { path: "/contact/" },
  { path: "/work/" },
  { path: "/highlevel-demo-video/" },
  { path: "/highlevel-video-bundle/" },
  { path: "/blog/" },
  { path: "/resources/" },
  { path: "/legal/privacy/" },
  { path: "/legal/terms/" },
  { path: "/legal/refund/" },
];

/* Known third-party noise, allowed by exact signature only. The LeadConnector
 * chat widget stamps mode="md" onto <html> before React hydrates, which
 * React 19 reports as a hydration attribute mismatch. Harmless, outside our
 * code, timing-dependent. Everything else stays a failure. */
const ALLOWED_ERRORS = [/mode="md"/];

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  const push = (text: string) => {
    if (!ALLOWED_ERRORS.some((re) => re.test(text))) errors.push(text);
  };
  page.on("console", (msg) => {
    if (msg.type() === "error") push(msg.text());
  });
  page.on("pageerror", (err) => push(String(err)));
  return errors;
}

for (const { path } of PAGES) {
  test(`${path} renders clean`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto(path);
    expect(res?.status(), `${path} should respond 200`).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/GHL Video/);
    expect(errors, `console errors on ${path}`).toEqual([]);
  });
}

test("header nav and footer chrome are present on the homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Book a Call" }).first()).toBeVisible();
  // testimonial cards also use <footer>; the page footer is the contentinfo
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("A brand of Vidiosa LLC");
  await expect(footer).toContainText("not affiliated with or endorsed by");
});

test("premade buy buttons route to on-domain checkout", async ({ page }) => {
  await page.goto("/premade/");
  const orderLinks = page.locator('a[href^="/checkout/"]');
  expect(await orderLinks.count()).toBeGreaterThan(0);
  const hrefs = await orderLinks.evaluateAll((as) =>
    as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  for (const href of hrefs) expect(href).toMatch(/^\/checkout\/[a-z0-9-]+\/?$/);
  // the external order site is retired: no buy link may point there
  expect(await page.locator('a[href*="order.ghlvideo.com"]').count()).toBe(0);
});

test("editing plans link their subscription skus", async ({ page }) => {
  await page.goto("/editing/");
  for (const sku of ["editing-starter", "editing-growth", "editing-scale"]) {
    await expect(page.locator(`a[href^="/checkout/${sku}"]`).first()).toBeAttached();
  }
});

test("sitemap and robots respond", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("ghlvideo.com");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /admin/");
});

test("stub pages are noindex", async ({ page }) => {
  for (const path of ["/blog/", "/resources/"]) {
    await page.goto(path);
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  }
});
