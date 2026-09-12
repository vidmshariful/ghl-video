import { test, expect } from "@playwright/test";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { api, ensureLogin, env, signIn, staging, tokenFor, watchConsole } from "./helpers";

/*
 * The custom line, end to end, on staging: the studio opens a client and a
 * project, raises the invoice, the client pays it in Stripe test mode, and
 * the money lands on the project with no video row and no brief. Then the
 * production line runs station by station, the client approves the
 * animation and the delivery, and finally briefs a second project directly.
 * Both sides, every step.
 */
test.describe.configure({ mode: "serial" });

const client = { email: "qa-custom@ghlvideo.test", password: "walk-through-2026!" };
const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const canRun = staging && Boolean(env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) && Boolean(admin.password);
const stamp = Date.now().toString(36);

let customerId = "";
let projectId = "";
let invoiceSku = "";
let invoiceNumber = "";
let orderId = "";

test.describe("custom, as the studio and the client", () => {
  test.skip(!canRun, "needs staging, a Stripe test key and the QA admin in .env.local");

  test("the studio opens the client, the project and the invoice", async () => {
    await ensureLogin(client);
    const token = await tokenFor(admin);
    const made = await api<{ id?: string; error?: string }>("/api/admin/customers/", {
      method: "POST",
      token,
      body: { email: client.email, name: "QA Custom Client", company: "QA Custom Co" },
    }).catch(async () => {
      /* already a client from an earlier run: the 409 carries the id */
      const list = await api<{ customers: { id: string; email: string }[] }>("/api/admin/customers/", { token });
      return { id: list.customers.find((c) => c.email === client.email)?.id };
    });
    customerId = String(made.id);
    expect(customerId).toMatch(/^[0-9a-f-]{36}$/);

    const project = await api<{ id: string }>("/api/admin/projects/", {
      method: "POST",
      token,
      body: {
        customerEmail: client.email,
        title: `Walkthrough explainer ${stamp}`,
        category: "Explainer",
        brief: "A ninety second explainer. Walkthrough, nothing real.",
        agreedCents: 150000,
      },
    });
    projectId = project.id;

    const inv = await api<{ invoice: { id: string; number: string; token: string } }>("/api/admin/invoices/", {
      method: "POST",
      token,
      body: {
        customerEmail: client.email,
        customerName: "QA Custom Client",
        customerCompany: "QA Custom Co",
        lineItems: [{ description: `Walkthrough explainer ${stamp}`, quantity: 1, unitCents: 150000 }],
        projectIds: [projectId],
        notes: "Walkthrough invoice.",
      },
    });
    invoiceNumber = inv.invoice.number;
    /* the pay link carries the sku; the API answer does not, so read the row */
    const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: row } = await db.from("invoices").select("product_sku").eq("id", inv.invoice.id).single();
    invoiceSku = String(row?.product_sku ?? "");
    expect(invoiceSku).toMatch(/^inv-/);
  });

  test("the client pays the invoice and the money lands on the project, not as premade work", async () => {
    const intent = await api<{ paymentIntentId: string; amountCents: number }>("/api/checkout/create-intent/", {
      method: "POST",
      body: { sku: invoiceSku },
    });
    expect(intent.amountCents).toBe(150000);
    const fin = await api<{ orderId: string }>("/api/checkout/finalize/", {
      method: "POST",
      body: {
        paymentIntentId: intent.paymentIntentId,
        email: client.email,
        name: "QA Custom Client",
        company: "QA Custom Co",
        phone: "+15555550101",
        password: client.password,
        bumpIds: [],
        couponCode: "",
      },
    });
    orderId = fin.orderId;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const confirmed = await stripe.paymentIntents.confirm(intent.paymentIntentId, {
      payment_method: "pm_card_visa",
      return_url: "http://localhost:3200/checkout/thank-you/",
    });
    expect(confirmed.status).toBe("succeeded");

    let order: { status: string; kind: string | null; paysInvoice: string | null } = { status: "", kind: null, paysInvoice: null };
    for (let i = 0; i < 10 && order.status !== "paid"; i += 1) {
      order = await api(`/api/orders/${orderId}/`);
      if (order.status !== "paid") await new Promise((r) => setTimeout(r, 1500));
    }
    expect(order.status).toBe("paid");
    expect(order.kind).toBe("invoice");
    expect(order.paysInvoice).toBe(invoiceNumber);

    const token = await tokenFor(admin);
    const vids = await api<{ deliverables: unknown[] }>(`/api/admin/orders/${orderId}/deliverables/`, { token });
    expect(vids.deliverables.length).toBe(0);
    const job = await api<{ job: { stage: string } }>(`/api/admin/orders/${orderId}/job/`, { token });
    expect(job.job.stage).toBe("delivered");
    const projects = await api<{ projects: { id: string; money: { paidCents: number; valueCents: number } }[] }>(
      "/api/admin/projects/",
      { token },
    );
    const mine = projects.projects.find((p) => p.id === projectId);
    expect(mine?.money.paidCents).toBe(150000);
    expect(mine?.money.valueCents).toBe(150000);
  });

  test("the client's portal reads the payment as a payment and the project as paid", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/portal/", client, /welcome back/i);
    await expect(page.getByText(/getting started/i)).toHaveCount(0);
    await page.goto("/portal/projects/");
    await expect(page.getByRole("heading", { name: "Custom", exact: true })).toBeVisible();
    await expect(page.getByText(`Walkthrough explainer ${stamp}`).first()).toBeVisible();
    await page.goto("/portal/orders/");
    await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible();
    await expect(page.getByText(new RegExp(`Invoice ${invoiceNumber}`)).first()).toBeVisible();
    await expect(page.getByText(/waiting on your brief/i)).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the production line runs, the client approves the animation and the delivery", async ({ page }) => {
    const errors = watchConsole(page);
    const token = await tokenFor(admin);
    const station = (key: string, state: string, extra: Record<string, unknown> = {}) =>
      api("/api/admin/projects/", { method: "PATCH", token, body: { id: projectId, station: { key, state, ...extra } } });
    await station("script", "done", { url: "https://docs.example.com/script" });
    await station("voiceover", "done");
    await station("design", "done");
    await station("animation", "with_client", { url: "https://example.com/walkthrough-animation.mp4" });

    const me = await tokenFor(client);
    const ready = await api<{ projects: { id: string; status: string; pipeline: { ball: string } }[] }>(
      "/api/portal/projects/",
      { token: me },
    );
    const p = ready.projects.find((x) => x.id === projectId);
    expect(p?.pipeline.ball).toBe("client");
    await api(`/api/portal/projects/${projectId}/stage-review/`, {
      method: "POST",
      token: me,
      body: { stage: "animation", action: "approve" },
    });
    await station("sfx", "done");
    await station("delivery", "with_client", { url: "https://example.com/walkthrough-final.mp4" });
    await api(`/api/portal/projects/${projectId}/stage-review/`, {
      method: "POST",
      token: me,
      body: { stage: "delivery", action: "approve" },
    });
    const after = await api<{ projects: { id: string; status: string; statusLabel: string }[] }>("/api/portal/projects/", {
      token: me,
    });
    expect(after.projects.find((x) => x.id === projectId)?.status).toMatch(/approved|cutdowns|closed/);

    await signIn(page, "/admin/", admin, /dashboard/i);
    await page.goto(`/admin/custom/${projectId}/`);
    await expect(page.getByText(`Walkthrough explainer ${stamp}`).first()).toBeVisible();
    await expect(page.getByText("QA Custom Co").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("a direct-brief client briefs the next project from the portal", async ({ page }) => {
    const errors = watchConsole(page);
    const token = await tokenFor(admin);
    await api(`/api/admin/customers/${customerId}/`, { method: "PATCH", token, body: { canSubmitProjects: true } });
    const me = await tokenFor(client);
    const made = await api<{ id: string }>("/api/portal/projects/", {
      method: "POST",
      token: me,
      body: {
        title: `Briefed from the portal ${stamp}`,
        script: "Scene one. Scene two. Walkthrough script.",
        category: "Explainer",
      },
    });
    expect(made.id).toMatch(/^[0-9a-f-]{36}$/);
    await signIn(page, "/admin/", admin, /dashboard/i);
    await page.goto("/admin/custom/");
    await expect(page.getByText(`Briefed from the portal ${stamp}`).first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
