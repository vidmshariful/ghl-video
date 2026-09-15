import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, env, staging, tokenFor } from "./helpers";

/*
 * Phase 5, on our pages with HighLevel mirroring: an enquiry from the
 * website becomes a deal card in the Leads pipeline; the studio raises a
 * quote and sends it (through HighLevel, with a note on the contact); the
 * lead accepts it on the public quote page with a typed name; the project
 * exists at the agreed price on both sides and the enquiry is won; the
 * retainer agreement is accepted in the portal and the contact shows it;
 * a partner appears in the sub-account as a tagged contact.
 */
test.describe.configure({ mode: "serial" });

const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const stamp = Date.now().toString(36);
const lead = { email: `qa-lead-${stamp}@ghlvideo.test`, name: "QA Lead Person", company: `QA Lead Co ${stamp}` };
const partnerClient = { email: "qa-highlevel@ghlvideo.test", password: "walk-through-2026!" };
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

async function link(kind: string, entityId: string, hlKind: string): Promise<string | null> {
  const { data } = await db()
    .from("hl_links")
    .select("hl_id")
    .eq("kind", kind)
    .eq("entity_id", entityId)
    .eq("hl_kind", hlKind)
    .eq("location_id", LOC)
    .maybeSingle();
  return data ? String(data.hl_id) : null;
}

async function notesOf(contactId: string): Promise<string[]> {
  const j = await hl("GET", `/contacts/${contactId}/notes`);
  return ((j.notes as Row[]) ?? []).map((n) => String(n.body ?? ""));
}

let token = "";
let cfg: { pipelines: { leads: { id: string; stages: Record<string, string> } }; contactFields: Record<string, string> };
let requestId = "";
let leadDealId = "";
let leadContactId = "";
let quoteId = "";
let quoteToken = "";
let projectId = "";

test.describe("quotes, the agreement, leads and partners", () => {
  test.skip(!canRun, "needs staging, the sandbox token and the QA admin in .env.local");

  test("an enquiry from the website becomes a deal card in the Leads pipeline", async () => {
    token = await tokenFor(admin);
    const { data } = await db().from("hl_config").select("config").eq("location_id", LOC).single();
    cfg = data!.config as typeof cfg;
    const r = await fetch("http://localhost:3200/api/quote/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lead.name, email: lead.email, company: lead.company, type: "Explainer", details: `A ninety second explainer. Walkthrough ${stamp}, nothing real.` }),
    });
    expect(r.status, await r.text()).toBe(200);
    const { data: req } = await db().from("project_requests").select("id, status").eq("email", lead.email).single();
    requestId = String(req?.id);
    expect(req?.status).toBe("new");

    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    leadDealId = String(await link("lead", requestId, "opportunity"));
    expect(leadDealId).not.toBe("null");
    const opp = (await hl("GET", `/opportunities/${leadDealId}`)).opportunity as Row;
    expect(opp.pipelineId).toBe(cfg.pipelines.leads.id);
    expect(opp.pipelineStageId).toBe(cfg.pipelines.leads.stages.new);
    leadContactId = String(opp.contactId ?? (opp.contact as Row | undefined)?.id);
    const contact = (await hl("GET", `/contacts/${leadContactId}`)).contact as Row;
    expect((contact.tags as string[]) ?? []).toContain("ghlv-lead");
    expect((await notesOf(leadContactId)).some((n) => n.includes(`Walkthrough ${stamp}`))).toBeTruthy();
  });

  test("the studio raises a quote and sends it; the card moves to Quoted and the contact gets a note", async () => {
    const made = await api<{ quote: { id: string; token: string; number: string; status: string } }>("/api/admin/quotes/", {
      method: "POST",
      token,
      body: {
        customerEmail: lead.email,
        customerName: lead.name,
        customerCompany: lead.company,
        requestId,
        title: `Explainer for ${lead.company}`,
        lineItems: [{ description: "Ninety second explainer", unitCents: 250000, quantity: 1 }, { description: "Square cut", unitCents: 15000, quantity: 2 }],
        discountKind: "percent",
        discountValue: 10,
        scope: "Script, voice, animation, two rounds of changes.",
        validUntil: "2026-12-31",
      },
    });
    quoteId = made.quote.id;
    quoteToken = made.quote.token;
    expect(made.quote.status).toBe("draft");
    expect(made.quote.number).toMatch(/^Q-\d+$/);
    const sent = await api<{ ok: boolean; quote: { status: string; totalCents: number } }>(`/api/admin/quotes/${quoteId}/`, { method: "PATCH", token, body: { action: "send" } });
    expect(sent.quote.status).toBe("sent");
    expect(sent.quote.totalCents).toBe(252000);

    const { data: req } = await db().from("project_requests").select("status").eq("id", requestId).single();
    expect(req?.status).toBe("quoted");
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const opp = (await hl("GET", `/opportunities/${leadDealId}`)).opportunity as Row;
    expect(opp.pipelineStageId).toBe(cfg.pipelines.leads.stages.quoted);

    const { data: logRow } = await db().from("email_log").select("template_key, status, meta").eq("to_email", lead.email).eq("template_key", "quote_sent").order("created_at", { ascending: false }).limit(1).maybeSingle();
    expect(logRow?.status).toBe("sent");
    if (env.HIGHLEVEL_EMAIL === "on") expect(((logRow?.meta as Row) ?? {}).provider).toBe("highlevel");
    expect((await notesOf(leadContactId)).some((n) => n.includes("sent from ghlvideo.com"))).toBeTruthy();
  });

  test("the lead accepts on the public quote page: the project exists at the agreed price on both sides", async () => {
    const page = await fetch(`http://localhost:3200/q/${quoteToken}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`Explainer for ${lead.company}`);
    expect(html).toContain("Type your name to accept");

    const r = await fetch(`http://localhost:3200/api/quotes/${quoteToken}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", name: lead.name }),
    });
    const j = (await r.json()) as { ok: boolean; projectId: string; error?: string };
    expect(r.status, JSON.stringify(j)).toBe(200);
    projectId = j.projectId;

    const { data: q } = await db().from("quotes").select("status, accepted_by, accepted_at, project_id").eq("id", quoteId).single();
    expect(q?.status).toBe("accepted");
    expect(q?.accepted_by).toBe(lead.name);
    expect(q?.project_id).toBe(projectId);
    const { data: p } = await db().from("projects").select("agreed_cents, quoted_cents, status, customer_email, source").eq("id", projectId).single();
    expect(Number(p?.agreed_cents)).toBe(252000);
    expect(p?.status).toBe("backlog");
    expect(p?.source).toBe("studio");
    const { data: req } = await db().from("project_requests").select("status, project_id").eq("id", requestId).single();
    expect(req?.status).toBe("won");
    expect(req?.project_id).toBe(projectId);
    /* the account exists for them now */
    const { data: c } = await db().from("customers").select("id, company").ilike("email", lead.email).single();
    expect(c?.company).toBe(lead.company);

    /* HighLevel: the lead card won, the project's deal card at the agreed price, the note */
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const leadOpp = (await hl("GET", `/opportunities/${leadDealId}`)).opportunity as Row;
    expect(leadOpp.status).toBe("won");
    const dealId = await link("project", projectId, "opportunity");
    expect(dealId).toBeTruthy();
    const deal = (await hl("GET", `/opportunities/${dealId}`)).opportunity as Row;
    expect(Number(deal.monetaryValue)).toBe(2520);
    expect((await notesOf(leadContactId)).some((n) => n.includes("accepted on ghlvideo.com"))).toBeTruthy();

    /* answered once; the page and the API both say so */
    const again = await fetch(`http://localhost:3200/api/quotes/${quoteToken}/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", name: lead.name }) });
    expect(again.status).toBe(409);
    expect(await (await fetch(`http://localhost:3200/q/${quoteToken}/`)).text()).toContain("Accepted");
  });

  test("a second quote for the project is declined in the portal, and the team learns why", async () => {
    const { ensureLogin } = await import("./helpers");
    await ensureLogin({ email: lead.email, password: "walk-through-2026!" });
    const me = await tokenFor({ email: lead.email, password: "walk-through-2026!" });
    const made = await api<{ quote: { id: string } }>("/api/admin/quotes/", {
      method: "POST",
      token,
      body: { customerEmail: lead.email, projectId, title: `Extra formats ${stamp}`, lineItems: [{ description: "Three vertical cuts", unitCents: 45000, quantity: 1 }] },
    });
    await api(`/api/admin/quotes/${made.quote.id}/`, { method: "PATCH", token, body: { action: "send" } });
    const mine = await api<{ quotes: { id: string; open: boolean }[]; canAnswer: boolean }>("/api/portal/quotes/", { token: me });
    expect(mine.canAnswer).toBe(true);
    expect(mine.quotes.find((q) => q.id === made.quote.id)?.open).toBe(true);
    await api("/api/portal/quotes/", { method: "POST", token: me, body: { id: made.quote.id, action: "decline", reason: "Not this quarter." } });
    const { data: q } = await db().from("quotes").select("status, decline_reason").eq("id", made.quote.id).single();
    expect(q?.status).toBe("declined");
    expect(q?.decline_reason).toBe("Not this quarter.");
    /* the project's own price is untouched by a declined add-on */
    const { data: p } = await db().from("projects").select("agreed_cents").eq("id", projectId).single();
    expect(Number(p?.agreed_cents)).toBe(252000);
  });

  test("the retainer agreement is accepted in the portal, and the contact shows it", async () => {
    test.slow(); /* a drain and four HighLevel reads: 54s on a clean run, three times the room */
    /* runnable on its own, so a retry or a filtered run does not depend on the first step */
    if (!token) token = await tokenFor(admin);
    if (!cfg) cfg = ((await db().from("hl_config").select("config").eq("location_id", LOC).single()).data!.config) as typeof cfg;
    const list = await api<{ customers: { id: string; email: string }[] }>("/api/admin/customers/", { token });
    const partnerId = String(list.customers.find((c) => c.email === partnerClient.email)?.id ?? "");
    expect(partnerId, "run the HighLevel walkthrough first: it makes this client").toMatch(/^[0-9a-f-]{36}$/);
    /* fresh terms, so a retried run does not inherit an earlier acceptance */
    await api(`/api/admin/customers/${partnerId}/`, { method: "PATCH", token, body: { retainer: null } });
    await api(`/api/admin/customers/${partnerId}/`, {
      method: "PATCH",
      token,
      body: { retainer: { name: "Retainer partnership", monthlyCents: 1100000, videosMin: 8, videosMax: 12, activeMax: 2, turnaroundDays: 3, whiteLabel: true, startedOn: "2026-09-01" } },
    });
    const sent = await api<{ ok: boolean }>(`/api/admin/customers/${partnerId}/agreement/`, { method: "POST", token, body: {} });
    expect(sent.ok).toBe(true);

    const { ensureLogin } = await import("./helpers");
    await ensureLogin(partnerClient);
    const me = await tokenFor(partnerClient);
    const before = await api<{ agreement: { agreedOn: string | null; monthlyCents: number } | null; canAccept: boolean }>("/api/portal/agreement/", { token: me });
    expect(before.agreement?.agreedOn).toBeNull();
    expect(before.agreement?.monthlyCents).toBe(1100000);
    expect(before.canAccept).toBe(true);
    const accepted = await api<{ ok: boolean; agreedOn: string; agreedBy: string }>("/api/portal/agreement/", { method: "POST", token: me, body: { name: "QA HighLevel" } });
    expect(accepted.agreedBy).toBe("QA HighLevel");

    /* the record keeps it, an edit that leaves the deal alone keeps it, a new fee clears it */
    const record = await api<{ customer: { retainer: { agreedOn: string | null; agreedBy: string | null } | null } }>(`/api/admin/customers/${partnerId}/`, { token });
    expect(record.customer.retainer?.agreedBy).toBe("QA HighLevel");
    await api(`/api/admin/customers/${partnerId}/`, { method: "PATCH", token, body: { retainer: { ...record.customer.retainer, checkInOn: "2026-12-15" } } });
    const kept = await api<{ customer: { retainer: { agreedOn: string | null } | null } }>(`/api/admin/customers/${partnerId}/`, { token });
    expect(kept.customer.retainer?.agreedOn).toBeTruthy();

    /* HighLevel: the note and the agreed-on field */
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const contactId = String(await link("customer", partnerId, "contact"));
    const contact = (await hl("GET", `/contacts/${contactId}`)).contact as Row;
    const agreed = ((contact.customFields as { id: string; value?: unknown }[]) ?? []).find((f) => f.id === cfg.contactFields.retainerAgreed);
    expect(String(agreed?.value ?? "")).toContain("by QA HighLevel");
    expect((await notesOf(contactId)).some((n) => n.includes("agreement accepted on ghlvideo.com"))).toBeTruthy();

    await api(`/api/admin/customers/${partnerId}/`, { method: "PATCH", token, body: { retainer: { ...record.customer.retainer, monthlyCents: 1200000 } } });
    const cleared = await api<{ customer: { retainer: { agreedOn: string | null } | null } }>(`/api/admin/customers/${partnerId}/`, { token });
    expect(cleared.customer.retainer?.agreedOn).toBeNull();
    await api(`/api/admin/customers/${partnerId}/`, { method: "PATCH", token, body: { retainer: null } });
  });

  test("a partner appears in the sub-account as a tagged contact with their handle", async () => {
    if (!token) token = await tokenFor(admin);
    if (!cfg) cfg = ((await db().from("hl_config").select("config").eq("location_id", LOC).single()).data!.config) as typeof cfg;
    const d = db();
    const email = "qa-partner@ghlvideo.test";
    const { data: existing } = await d.from("partners").select("id").eq("email", email).maybeSingle();
    let partnerRowId = existing ? String(existing.id) : "";
    if (!partnerRowId) {
      const { data: made, error } = await d
        .from("partners")
        .insert({ ref: "qa-partner", name: "QA Partner", email, status: "active", tier: "vip" })
        .select("id")
        .single();
      expect(error?.message ?? "").toBe("");
      partnerRowId = String(made?.id);
    } else {
      await d.from("partners").update({ status: "active", tier: "vip", updated_at: new Date().toISOString() }).eq("id", partnerRowId);
    }
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const contactId = String(await link("partner", partnerRowId, "contact"));
    expect(contactId).not.toBe("null");
    const contact = (await hl("GET", `/contacts/${contactId}`)).contact as Row;
    expect((contact.tags as string[]) ?? []).toContain("ghlv-partner");
    const fields = (contact.customFields as { id: string; value?: unknown }[]) ?? [];
    expect(String(fields.find((f) => f.id === cfg.contactFields.partnerRef)?.value ?? "")).toBe("qa-partner");
    expect(String(fields.find((f) => f.id === cfg.contactFields.partnerTier)?.value ?? "")).toBe("VIP Affiliate Partner");
  });
});
