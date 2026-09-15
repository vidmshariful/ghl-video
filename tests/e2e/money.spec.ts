import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, env, staging, tokenFor } from "./helpers";

/*
 * Money in HighLevel, end to end, against the real sandbox: the studio
 * raises an invoice for a project, HighLevel holds it and the client's pay
 * link is HighLevel's; the invoice is paid over there (recorded, the way a
 * card payment lands) and the project reads paid here with no order row;
 * a premade sale paid on the site is recorded in HighLevel as a paid
 * invoice on the contact; and retainer terms become a monthly schedule.
 * Every assertion reads HighLevel itself.
 */
test.describe.configure({ mode: "serial" });

const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const client = { email: "qa-highlevel@ghlvideo.test", name: "QA HighLevel", company: "QA HighLevel Co" };
const stamp = Date.now().toString(36);
const HL = "https://services.leadconnectorhq.com";
const LOC = env.HIGHLEVEL_LOCATION_ID ?? "";
const canRun = staging && Boolean(env.HIGHLEVEL_API_TOKEN) && Boolean(LOC) && Boolean(admin.password);

type Row = Record<string, unknown>;
const db = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function hl(method: string, path: string, body?: unknown): Promise<Row> {
  const r = await fetch(`${HL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.HIGHLEVEL_API_TOKEN}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: Row = {};
  try {
    json = JSON.parse(text) as Row;
  } catch {
    /* empty body */
  }
  expect(r.ok, `${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`).toBeTruthy();
  return json;
}
const Q = `altId=${LOC}&altType=location`;

let token = "";
let customerId = "";
let projectId = "";
let invoiceId = "";
let hlInvoiceId = "";

test.describe("money, in HighLevel", () => {
  test.skip(!canRun, "needs staging, the sandbox token and the QA admin in .env.local");

  test("the studio opens a project for the test client", async () => {
    token = await tokenFor(admin);
    const { data: cfg } = await db().from("hl_config").select("config").eq("location_id", LOC).maybeSingle();
    expect(cfg?.config, "run npm run hl:provision first").toBeTruthy();
    const made = await api<{ id?: string }>("/api/admin/customers/", {
      method: "POST",
      token,
      body: { email: client.email, name: client.name, company: client.company },
    }).catch(async () => {
      const list = await api<{ customers: { id: string; email: string }[] }>("/api/admin/customers/", { token });
      return { id: list.customers.find((c) => c.email === client.email)?.id };
    });
    customerId = String(made.id);
    const project = await api<{ id: string }>("/api/admin/projects/", {
      method: "POST",
      token,
      body: {
        customerEmail: client.email,
        title: `Money walkthrough ${stamp}`,
        category: "Explainer",
        brief: "A project to bill. Nothing real.",
        agreedCents: 180000,
      },
    });
    projectId = project.id;
  });

  test("an invoice raised here is made in HighLevel, with HighLevel's pay link", async () => {
    const made = await api<{ invoice: Row }>("/api/admin/invoices/", {
      method: "POST",
      token,
      body: {
        customerEmail: client.email,
        customerName: client.name,
        customerCompany: client.company,
        projectIds: [projectId],
        lineItems: [{ description: `Explainer, ninety seconds ${stamp}`, unitCents: 180000, quantity: 1 }],
        notes: "Half up front, the rest on approval.",
        dueDate: "2026-10-01",
      },
    });
    invoiceId = String(made.invoice.id);
    /* no product behind it: the invoice product hack is gone */
    const { data: row } = await db().from("invoices").select("product_id, product_sku, hl_invoice_id, hl_url, hl_status, kind").eq("id", invoiceId).single();
    expect(row?.product_id).toBeNull();
    expect(row?.product_sku).toBeNull();
    expect(row?.kind).toBe("custom");
    if (!row?.hl_invoice_id) await api("/api/cron/hl-sync/", { token });
    const { data: again } = await db().from("invoices").select("hl_invoice_id, hl_url, hl_status").eq("id", invoiceId).single();
    hlInvoiceId = String(again?.hl_invoice_id);
    expect(hlInvoiceId).toMatch(/^[0-9a-f]{24}$/);
    expect(again?.hl_url).toBe(`https://link.msgsndr.com/invoice/${hlInvoiceId}`);
    const hlInv = await hl("GET", `/invoices/${hlInvoiceId}?${Q}`);
    expect(Number(hlInv.total)).toBe(1800);
    expect(String((hlInv.contactDetails as Row).email)).toBe(client.email);
    expect(String(hlInv.status)).toBe("draft");

    /* the pay link reaches the client's portal and the public invoice page */
    const { data: inv } = await db().from("invoices").select("token").eq("id", invoiceId).single();
    const page = await fetch(`http://localhost:3200/invoice/${String(inv?.token)}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain(`https://link.msgsndr.com/invoice/${hlInvoiceId}`);
  });

  test("marking it sent sends it from HighLevel", async () => {
    await api(`/api/admin/invoices/${invoiceId}/`, { method: "PATCH", token, body: { action: "sent" } });
    const { data: row } = await db().from("invoices").select("hl_status, hl_sent_at, sent_at").eq("id", invoiceId).single();
    expect(row?.sent_at).toBeTruthy();
    expect(row?.hl_sent_at).toBeTruthy();
    const hlInv = await hl("GET", `/invoices/${hlInvoiceId}?${Q}`);
    expect(String(hlInv.status)).toBe("sent");
  });

  test("paid in HighLevel, the project reads paid here and no order row appears", async () => {
    const { count: before } = await db().from("orders").select("id", { count: "exact", head: true }).ilike("customer_email", client.email);
    /* the payment lands on HighLevel's side: recorded the way a card payment settles there */
    await hl("POST", `/invoices/${hlInvoiceId}/record-payment`, {
      altId: LOC,
      altType: "location",
      mode: "card",
      card: { brand: "visa", last4: "4242" },
      notes: `walkthrough ${stamp}`,
      amount: 1800,
    });
    /* the minute cron reads it back, either through the outbox row the send
       left behind or through the poll of open invoices; both end the same */
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const { data: row } = await db().from("invoices").select("paid_at, hl_status, amount_paid_cents").eq("id", invoiceId).single();
    expect(row?.paid_at).toBeTruthy();
    expect(row?.hl_status).toBe("paid");
    expect(Number(row?.amount_paid_cents)).toBe(180000);

    const { count: after } = await db().from("orders").select("id", { count: "exact", head: true }).ilike("customer_email", client.email);
    expect(after).toBe(before);

    /* the project's money, both for the studio and the client */
    const list = await api<{ projects: { id: string; money: { paidCents: number; outstandingCents: number }; invoices: { paid: boolean }[] }[] }>("/api/admin/projects/", { token });
    const p = list.projects.find((x) => x.id === projectId);
    expect(p?.money.paidCents).toBe(180000);
    expect(p?.money.outstandingCents).toBe(0);
    expect(p?.invoices[0]?.paid).toBe(true);

    const record = await api<{ invoices: { id: string; paid: boolean; status: string }[]; value: { customCents: number; openInvoicesCents: number } }>(`/api/admin/customers/${customerId}/`, { token });
    expect(record.invoices.find((i) => i.id === invoiceId)?.paid).toBe(true);
    expect(record.value.customCents).toBeGreaterThanOrEqual(180000);
  });

  test("a premade sale paid on the site is recorded in HighLevel as a paid invoice", async () => {
    /* the most recent paid premade order of a test buyer, from the premade walkthrough */
    const { data: order } = await db()
      .from("orders")
      .select("id, customer_email, amount_cents, hl_invoice_id, product:products(metadata)")
      .eq("status", "paid")
      .ilike("customer_email", "qa-premade@ghlvideo.test")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    test.skip(!order, "no paid premade test order yet: run the premade walkthrough first");
    if (!order!.hl_invoice_id) {
      await db().rpc("hl_enqueue", { p_kind: "order", p_entity: order!.id, p_reason: "walkthrough" });
      const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
      expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    }
    const { data: again } = await db().from("orders").select("hl_invoice_id").eq("id", order!.id).single();
    expect(again?.hl_invoice_id).toBeTruthy();
    const hlInv = await hl("GET", `/invoices/${String(again?.hl_invoice_id)}?${Q}`);
    expect(String(hlInv.status)).toBe("paid");
    expect(Math.round(Number(hlInv.amountPaid) * 100)).toBe(Number(order!.amount_cents));
    expect(String((hlInv.contactDetails as Row).email)).toBe("qa-premade@ghlvideo.test");
  });

  test("retainer terms become a monthly schedule in HighLevel, and go when they go", async () => {
    test.slow(); /* two drains against HighLevel: 57s on a slow evening, three times the room */
    await api(`/api/admin/customers/${customerId}/`, {
      method: "PATCH",
      token,
      body: {
        retainer: { name: "Retainer partnership", monthlyCents: 1100000, videosMin: 8, videosMax: 12, activeMax: 2, turnaroundDays: 3, whiteLabel: true, startedOn: "2026-09-01" },
      },
    });
    let out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const { data: c } = await db().from("customers").select("hl_retainer_schedule_id").eq("id", customerId).single();
    const scheduleId = String(c?.hl_retainer_schedule_id ?? "");
    expect(scheduleId).toMatch(/^[0-9a-f]{24}$/);
    const schedule = await hl("GET", `/invoices/schedule/${scheduleId}?${Q}`);
    expect(String(schedule.status)).toBe("scheduled");
    expect(Number(schedule.total)).toBe(11000);
    const rrule = ((schedule.schedule as Row).rrule as Row) ?? {};
    expect(rrule.intervalType).toBe("monthly");
    expect(rrule.dayOfMonth).toBe(1);

    /* the record says so */
    const record = await api<{ customer: { retainerScheduleId: string | null } }>(`/api/admin/customers/${customerId}/`, { token });
    expect(record.customer.retainerScheduleId).toBe(scheduleId);

    /* terms removed: the schedule is cancelled, not left billing a client who is no longer a partner */
    await api(`/api/admin/customers/${customerId}/`, { method: "PATCH", token, body: { retainer: null } });
    out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const { data: c2 } = await db().from("customers").select("hl_retainer_schedule_id").eq("id", customerId).single();
    expect(c2?.hl_retainer_schedule_id).toBeNull();
    const gone = await hl("GET", `/invoices/schedule/${scheduleId}?${Q}`);
    expect(["cancelled", "canceled", "draft"]).toContain(String(gone.status));
  });

  test("voiding an open invoice voids it in HighLevel", async () => {
    const made = await api<{ invoice: Row }>("/api/admin/invoices/", {
      method: "POST",
      token,
      body: {
        customerEmail: client.email,
        lineItems: [{ description: `Raised by mistake ${stamp}`, unitCents: 5000, quantity: 1 }],
      },
    });
    const id = String(made.invoice.id);
    await api(`/api/admin/invoices/${id}/`, { method: "PATCH", token, body: { action: "sent" } });
    await api(`/api/admin/invoices/${id}/`, { method: "PATCH", token, body: { action: "void" } });
    const { data: row } = await db().from("invoices").select("status, hl_status, hl_invoice_id, paid_at").eq("id", id).single();
    expect(row?.status).toBe("void");
    expect(row?.hl_status).toBe("void");
    expect(row?.paid_at).toBeNull();
    /* HighLevel stops answering for a voided invoice: gone from its list and its pay page */
    const r = await fetch(`${HL}/invoices/${String(row?.hl_invoice_id)}?${Q}`, {
      headers: { Authorization: `Bearer ${env.HIGHLEVEL_API_TOKEN}`, Version: "2021-07-28", Accept: "application/json" },
    });
    const body = (await r.json().catch(() => ({}))) as Row;
    expect(r.status === 404 || String(body.status) === "void", `HighLevel answered ${r.status} ${JSON.stringify(body).slice(0, 120)}`).toBeTruthy();
    /* and no link is left for the nightly check to chase */
    const { data: link } = await db().from("hl_links").select("hl_id").eq("kind", "invoice").eq("entity_id", id).maybeSingle();
    expect(link).toBeNull();
  });
});
