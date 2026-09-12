import { test, expect } from "@playwright/test";
import Stripe from "stripe";
import { api, ensureLogin, env, signIn, staging, tokenFor, watchConsole } from "./helpers";

/*
 * The premade line, end to end, on staging: buy a video, pay in Stripe test
 * mode, brief it, produce it, send it for review, approve it, and see it
 * delivered, checking both sides at every step. The card is never typed:
 * the test confirms the payment through Stripe's API with a test method,
 * which is what a real card does after the form.
 *
 * Every run buys with the same test email, so the account grows a video
 * per run and staging:refresh clears it. Writes nothing to production and
 * cannot: the staging env carries no live key.
 */
test.describe.configure({ mode: "serial" });

const SKU = "mkt-002";
const buyer = { email: "qa-premade@ghlvideo.test", password: "walk-through-2026!" };
const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const canRun = staging && Boolean(env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) && Boolean(admin.password);

let orderId = "";
let deliverableId = "";

test.describe("premade, as the buyer and the studio", () => {
  test.skip(!canRun, "needs staging, a Stripe test key and the QA admin in .env.local");

  test("a video is bought and paid, and the order settles with its video", async () => {
    await ensureLogin(buyer);
    const intent = await api<{ clientSecret: string; paymentIntentId: string; amountCents: number }>(
      "/api/checkout/create-intent/",
      { method: "POST", body: { sku: SKU } },
    );
    expect(intent.amountCents).toBeGreaterThan(0);

    const fin = await api<{ orderId: string }>("/api/checkout/finalize/", {
      method: "POST",
      body: {
        paymentIntentId: intent.paymentIntentId,
        email: buyer.email,
        name: "QA Premade Buyer",
        company: "QA Agency",
        phone: "+15555550100",
        password: buyer.password,
        bumpIds: [],
        couponCode: "",
      },
    });
    orderId = fin.orderId;
    expect(orderId).toMatch(/^[0-9a-f-]{36}$/);

    /* the card, as Stripe's test method rather than typed */
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const confirmed = await stripe.paymentIntents.confirm(intent.paymentIntentId, {
      payment_method: "pm_card_visa",
      return_url: "http://localhost:3200/checkout/thank-you/",
    });
    expect(confirmed.status).toBe("succeeded");

    /* the thank-you page's poll settles the order without the webhook */
    let status = "";
    for (let i = 0; i < 10 && status !== "paid"; i += 1) {
      const o = await api<{ status: string; kind: string | null }>(`/api/orders/${orderId}/`);
      status = o.status;
      if (status !== "paid") await new Promise((r) => setTimeout(r, 1500));
    }
    expect(status).toBe("paid");

    const adminToken = await tokenFor(admin);
    const list = await api<{ deliverables: { id: string; title: string; status: string }[] }>(
      `/api/admin/orders/${orderId}/deliverables/`,
      { token: adminToken },
    );
    expect(list.deliverables.length).toBe(1);
    deliverableId = list.deliverables[0].id;
    expect(list.deliverables[0].status).toBe("queued");
  });

  test("the buyer briefs the order, and the portal shows the video waiting on the studio", async ({ page }) => {
    const errors = watchConsole(page);
    const form = new FormData();
    form.set("brandName", "QA Agency");
    form.set("primaryColor", "#0090FC");
    form.set("accentColor", "#FCC000");
    form.set("brandPronunciation", "kew-ay");
    form.set("notes", "Walkthrough brief. Nothing here is real.");
    await api(`/api/intake/${orderId}/`, { method: "POST", form });

    await signIn(page, "/portal/", buyer, /welcome back/i);
    await expect(page.getByText(/waiting on you/i).first()).toBeVisible();
    await page.goto("/portal/videos/");
    await expect(page.getByRole("heading", { name: /pre-made/i })).toBeVisible();
    await expect(page.getByText("Content AI").first()).toBeVisible();
    await page.goto(`/portal/orders/`);
    await expect(page.getByText(/paid|in production|intake/i).first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the studio produces the cut and sends it for review", async ({ page }) => {
    const errors = watchConsole(page);
    const token = await tokenFor(admin);
    await api(`/api/admin/orders/${orderId}/job/`, { method: "PATCH", token, body: { stage: "production" } });
    await api(`/api/admin/orders/${orderId}/deliverables/`, {
      method: "PATCH",
      token,
      body: { deliverableId, videoUrl: "https://example.com/walkthrough-cut-1.mp4", versionNote: "First cut" },
    });
    await api(`/api/admin/orders/${orderId}/deliverables/`, {
      method: "PATCH",
      token,
      body: { deliverableId, status: "ready" },
    });

    await signIn(page, "/admin/", admin, /dashboard/i);
    await page.goto("/admin/production/");
    await expect(page.getByRole("heading", { name: /premade/i })).toBeVisible();
    /* the board's tabs are plain buttons */
    await page.getByRole("button", { name: /^the board$/i }).click();
    await expect(page.getByText(/QA Premade Buyer|QA Agency/).first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the buyer sees it ready, approves it, and the order is delivered", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/portal/", buyer, /welcome back/i);
    await expect(page.getByText(/ready to watch/i).first()).toBeVisible();

    const token = await tokenFor(buyer);
    await api(`/api/portal/videos/${deliverableId}/review/`, { method: "POST", token, body: { action: "approve" } });

    await page.goto("/portal/videos/");
    await expect(page.getByText(/approved/i).first()).toBeVisible();
    const o = await api<{ status: string }>(`/api/orders/${orderId}/`);
    expect(o.status).toBe("paid");
    const adminToken = await tokenFor(admin);
    const job = await api<{ job: { stage: string } }>(`/api/admin/orders/${orderId}/job/`, { token: adminToken });
    expect(job.job.stage).toBe("delivered");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
