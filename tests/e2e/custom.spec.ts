import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, ensureLogin, env, signIn, staging, tokenFor, watchConsole } from "./helpers";

/*
 * The custom line, end to end, on staging: the studio opens a client and a
 * project, raises the invoice, HighLevel holds it and the client pays it
 * there (the payment is recorded the way a card payment settles on
 * HighLevel's page), and the money lands on the project with no order row,
 * no video row and no brief. Then the
 * production line runs station by station, the client approves the
 * animation and the delivery, and finally briefs a second project directly.
 * Both sides, every step.
 */
test.describe.configure({ mode: "serial" });

const client = { email: "qa-custom@ghlvideo.test", password: "walk-through-2026!" };
const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const canRun = staging && Boolean(env.HIGHLEVEL_API_TOKEN) && Boolean(env.HIGHLEVEL_LOCATION_ID) && Boolean(admin.password);
const stamp = Date.now().toString(36);
const LOC = env.HIGHLEVEL_LOCATION_ID ?? "";

let customerId = "";
let projectId = "";
let invoiceId = "";
let invoiceNumber = "";
let hlInvoiceId = "";

test.describe("custom, as the studio and the client", () => {
  test.skip(!canRun, "needs staging, the sandbox token and the QA admin in .env.local");

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
    invoiceId = inv.invoice.id;
    /* no product, no checkout: the invoice is made in HighLevel by the sync,
       and the client's pay link is HighLevel's page */
    const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    let { data: row } = await db.from("invoices").select("product_sku, hl_invoice_id, hl_number, hl_url").eq("id", invoiceId).single();
    if (!row?.hl_invoice_id) {
      await api("/api/cron/hl-sync/", { token });
      ({ data: row } = await db.from("invoices").select("product_sku, hl_invoice_id, hl_number, hl_url").eq("id", invoiceId).single());
    }
    expect(row?.product_sku).toBeNull();
    hlInvoiceId = String(row?.hl_invoice_id ?? "");
    expect(hlInvoiceId).toMatch(/^[0-9a-f]{24}$/);
    expect(row?.hl_url).toBe(`https://link.msgsndr.com/invoice/${hlInvoiceId}`);
    invoiceNumber = String(row?.hl_number ?? inv.invoice.number);
  });

  test("the client pays the invoice in HighLevel and the money lands on the project, not as premade work", async () => {
    const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { count: ordersBefore } = await db.from("orders").select("id", { count: "exact", head: true }).ilike("customer_email", client.email);

    /* the payment lands on HighLevel's side, recorded the way a card payment settles there */
    const r = await fetch(`https://services.leadconnectorhq.com/invoices/${hlInvoiceId}/record-payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HIGHLEVEL_API_TOKEN}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ altId: LOC, altType: "location", mode: "card", card: { brand: "visa", last4: "4242" }, notes: `walkthrough ${stamp}`, amount: 1500 }),
    });
    expect(r.ok, `record-payment -> ${r.status}: ${(await r.text()).slice(0, 200)}`).toBeTruthy();

    /* the minute cron reads it back */
    const token = await tokenFor(admin);
    const out = await api<{ failed: number; rows: unknown[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const { data: row } = await db.from("invoices").select("paid_at, hl_status, amount_paid_cents").eq("id", invoiceId).single();
    expect(row?.paid_at).toBeTruthy();
    expect(row?.hl_status).toBe("paid");
    expect(Number(row?.amount_paid_cents)).toBe(150000);

    /* money, never work: no order row, so no video row and no brief to chase */
    const { count: ordersAfter } = await db.from("orders").select("id", { count: "exact", head: true }).ilike("customer_email", client.email);
    expect(ordersAfter).toBe(ordersBefore);
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
    /* their receipt: the paid invoice, by HighLevel's number, with nothing to pay */
    await expect(page.getByText(new RegExp(`${invoiceNumber} / paid`)).first()).toBeVisible();
    await expect(page.getByText(/invoice to pay/i)).toHaveCount(0);
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
