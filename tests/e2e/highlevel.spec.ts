import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, env, staging, tokenFor } from "./helpers";

/*
 * The HighLevel wire, end to end, against the real sandbox: the studio
 * opens a client and the sync makes the contact with the right fields and
 * tags; a project becomes a deal card in the right stage and moves when
 * the status does; a video becomes a record tied to the contact; and an
 * edit made on the HighLevel side comes back through the webhook and goes
 * out again. Every assertion reads HighLevel itself, never our own links.
 *
 * The client is a fixed test account. Each run deletes its contact first
 * so the run proves creation, and leaves everything in place afterwards so
 * it can be looked at in the sub-account.
 */
test.describe.configure({ mode: "serial" });

const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const client = { email: "qa-highlevel@ghlvideo.test", name: "QA HighLevel", company: "QA HighLevel Co" };
const stamp = Date.now().toString(36);
const HL = "https://services.leadconnectorhq.com";
const LOC = env.HIGHLEVEL_LOCATION_ID ?? "";
const canRun =
  staging && Boolean(env.HIGHLEVEL_API_TOKEN) && Boolean(LOC) && Boolean(admin.password) && Boolean(env.HIGHLEVEL_WEBHOOK_SECRET);

type Row = Record<string, unknown>;
type Cfg = {
  contactFields: Record<string, string>;
  pipelines: { projects: { id: string; stages: Record<string, string> } };
  objects: { project: { key: string }; video: { key: string } };
};

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

async function contactByEmail(email: string): Promise<Row | null> {
  const j = await hl("POST", "/contacts/search", {
    locationId: LOC,
    filters: [{ field: "email", operator: "eq", value: email }],
    pageLimit: 5,
  });
  return ((j.contacts as Row[]) ?? [])[0] ?? null;
}

/** The contact straight from its id: the search index lags a few seconds behind a write. */
async function contactById(id: string): Promise<Row> {
  const j = await hl("GET", `/contacts/${id}`);
  return (j.contact as Row) ?? j;
}

/** Delete a contact if it is still there; the search index can name one already gone. */
async function deleteContact(id: string): Promise<void> {
  await fetch(`${HL}/contacts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${env.HIGHLEVEL_API_TOKEN}`, Version: "2021-07-28", Accept: "application/json" },
  });
}

const fieldValue = (contact: Row, id: string) =>
  ((contact.customFields as { id: string; value?: unknown; fieldValue?: unknown }[]) ?? []).find((f) => f.id === id);

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

let cfg: Cfg;
let token = "";
let customerId = "";
let contactId = "";
let projectId = "";
let dealId = "";

test.describe("HighLevel, both ways", () => {
  test.skip(!canRun, "needs staging, the sandbox token, the QA admin and HIGHLEVEL_WEBHOOK_SECRET in .env.local");

  test("the sub-account is provisioned and the test client starts fresh", async () => {
    const { data } = await db().from("hl_config").select("config").eq("location_id", LOC).maybeSingle();
    expect(data?.config, "run npm run hl:provision first").toBeTruthy();
    cfg = data!.config as Cfg;
    token = await tokenFor(admin);

    /* the client, made or found the way the studio makes one */
    const made = await api<{ id?: string }>("/api/admin/customers/", {
      method: "POST",
      token,
      body: { email: client.email, name: client.name, company: client.company },
    }).catch(async () => {
      const list = await api<{ customers: { id: string; email: string }[] }>("/api/admin/customers/", { token });
      return { id: list.customers.find((c) => c.email === client.email)?.id };
    });
    customerId = String(made.id);
    expect(customerId).toMatch(/^[0-9a-f-]{36}$/);

    /* start clean on the HighLevel side so this run proves creation: the
       contact our link names, and any the search still lists for the email.
       Our own row goes back to its known details too: an earlier run's
       polled edit would otherwise travel into the fresh contact. */
    const d = db();
    await d.from("customers").update({ name: client.name, company: client.company, phone: null }).eq("id", customerId);
    const linked = await link("customer", customerId, "contact");
    const old = await contactByEmail(client.email);
    for (const id of new Set([linked, old ? String(old.id) : null].filter(Boolean) as string[])) await deleteContact(id);
    await d.from("hl_links").delete().eq("kind", "customer").eq("entity_id", customerId);
    const { data: theirs } = await d.from("projects").select("id").ilike("customer_email", client.email);
    const ids = (theirs ?? []).map((p) => String(p.id));
    if (ids.length) await d.from("hl_links").delete().eq("kind", "project").in("entity_id", ids);
    /* and make sure the customer is queued, whatever earlier runs left */
    await d.rpc("hl_enqueue", { p_kind: "customer", p_entity: customerId, p_reason: "walkthrough" });
  });

  test("the sync makes the contact with our fields and tags", async () => {
    const out = await api<{ provisioned: boolean; done: number; failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.provisioned).toBeTruthy();
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);

    /* by the link the sync wrote and then by id: the search index lags a
       write by seconds and can still list a contact deleted a moment ago */
    contactId = String(await link("customer", customerId, "contact"));
    expect(contactId, "the sync should have linked a contact").toMatch(/^[A-Za-z0-9]{20}$/);
    const contact = await contactById(contactId);
    expect(contact.firstName ?? contact.first_name).toBe("QA");
    expect(String(contact.companyName ?? contact.company_name ?? "")).toBe(client.company);

    const id = fieldValue(contact, cfg.contactFields.customerId);
    expect(String(id?.value ?? id?.fieldValue ?? "")).toBe(customerId);
    const url = fieldValue(contact, cfg.contactFields.adminUrl);
    expect(String(url?.value ?? url?.fieldValue ?? "")).toContain(`/admin/customers/${customerId}/`);
    const tags = (contact.tags as string[]) ?? [];
    expect(tags.some((t) => t === "ghlv-lead" || t === "ghlv-custom"), tags.join(",")).toBeTruthy();
  });

  test("a project becomes a deal card in Backlog and a record tied to the contact", async () => {
    const project = await api<{ id: string }>("/api/admin/projects/", {
      method: "POST",
      token,
      body: {
        customerEmail: client.email,
        title: `HighLevel walkthrough ${stamp}`,
        category: "Explainer",
        brief: "A walkthrough project for the sync. Nothing real.",
        agreedCents: 250000,
      },
    });
    projectId = project.id;

    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);

    dealId = String(await link("project", projectId, "opportunity"));
    expect(dealId).not.toBe("null");
    const opp = (await hl("GET", `/opportunities/${dealId}`)).opportunity as Row;
    expect(opp.name).toBe(`HighLevel walkthrough ${stamp}`);
    expect(opp.pipelineId).toBe(cfg.pipelines.projects.id);
    expect(opp.pipelineStageId).toBe(cfg.pipelines.projects.stages.backlog);
    expect(Number(opp.monetaryValue)).toBe(2500);
    expect(opp.contactId ?? (opp.contact as Row | undefined)?.id).toBe(contactId);

    const recId = await link("project", projectId, "record");
    expect(recId).toBeTruthy();
    const rec = (await hl("GET", `/objects/${cfg.objects.project.key}/records/${recId}?locationId=${LOC}`)).record as Row;
    const props = (rec.properties as Row) ?? {};
    expect(props.title).toBe(`HighLevel walkthrough ${stamp}`);
    expect(props.status).toBe("Backlog");
    expect(props.agreed).toBe("$2,500");
    expect(props.client_email).toBe(client.email);

    /* the client is now a custom client, and the contact says so */
    const contact = await contactById(contactId);
    expect((contact.tags as string[]) ?? []).toContain("ghlv-custom");
    expect((contact.tags as string[]) ?? []).not.toContain("ghlv-lead");
  });

  test("moving the project moves the deal card", async () => {
    await api("/api/admin/projects/", { method: "PATCH", token, body: { id: projectId, stage: "in_progress" } });
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const opp = (await hl("GET", `/opportunities/${dealId}`)).opportunity as Row;
    expect(opp.pipelineStageId).toBe(cfg.pipelines.projects.stages.in_progress);
    expect(opp.status).toBe("open");
  });

  test("a video on the project becomes a record", async () => {
    await api("/api/admin/projects/videos/", { method: "POST", token, body: { projectId, title: `Square cut ${stamp}` } });
    const { data: v } = await db()
      .from("order_deliverables")
      .select("id")
      .eq("project_id", projectId)
      .ilike("title", `Square cut ${stamp}`)
      .maybeSingle();
    expect(v?.id).toBeTruthy();

    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const recId = await link("video", String(v!.id), "record");
    expect(recId).toBeTruthy();
    const rec = (await hl("GET", `/objects/${cfg.objects.video.key}/records/${recId}?locationId=${LOC}`)).record as Row;
    const props = (rec.properties as Row) ?? {};
    expect(props.title).toBe(`Square cut ${stamp}`);
    expect(props.kind).toBe("custom");
    expect(props.status).toBe("queued");
  });

  test("an edit made in HighLevel comes back, and goes out again", async () => {
    const phone = `+1555010${stamp.slice(-4).replace(/[^0-9]/g, "7").padStart(4, "0")}`;
    const r = await fetch(`http://localhost:3200/api/webhooks/highlevel/?key=${encodeURIComponent(env.HIGHLEVEL_WEBHOOK_SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ContactUpdate",
        contact_id: contactId,
        email: client.email,
        first_name: "QA",
        last_name: "HighLevel",
        phone,
        company_name: client.company,
      }),
    });
    const j = (await r.json()) as { ok: boolean; outcome: string; changed: string[] };
    expect(r.status, JSON.stringify(j)).toBe(200);
    expect(j.changed).toContain("phone");

    const { data: c } = await db().from("customers").select("phone, name").eq("id", customerId).single();
    expect(c?.phone).toBe(phone);
    const { data: inbound } = await db()
      .from("hl_inbound")
      .select("outcome")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(String(inbound?.outcome)).toContain("phone");

    /* the change queued the customer; the next send carries it back */
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const contact = await contactById(contactId);
    expect(String(contact.phone ?? "").replace(/[^0-9]/g, "")).toBe(phone.replace(/[^0-9]/g, ""));
  });

  test("an edit made in HighLevel comes back on its own, with no workflow at all", async () => {
    /* the studio changes the company on the contact inside HighLevel */
    const company = `QA HighLevel Co ${stamp}`;
    await hl("PUT", `/contacts/${contactId}`, { companyName: company });
    /* the minute cron asks HighLevel what changed and applies it; HighLevel's
       search index lags a write by some seconds, so the next minute may be the one */
    let seen: string | null = null;
    for (let i = 0; i < 6 && seen !== company; i += 1) {
      if (i) await new Promise((r) => setTimeout(r, 8000));
      const out = await api<{ contacts: { seen: number; changed: number; outcomes: string[] } | null }>("/api/cron/hl-sync/", { token });
      expect(out.contacts, "the cron should poll contacts").toBeTruthy();
      const { data: c } = await db().from("customers").select("company").eq("id", customerId).single();
      seen = (c?.company as string | null) ?? null;
    }
    expect(seen).toBe(company);
    const { data: inbound } = await db()
      .from("hl_inbound")
      .select("event, outcome")
      .eq("event", "contact.changed (polled)")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(String(inbound?.outcome)).toContain("company");
  });

  test("a wrong key is refused and nothing is written", async () => {
    const before = await db().from("hl_inbound").select("id", { count: "exact", head: true });
    const r = await fetch(`http://localhost:3200/api/webhooks/highlevel/?key=not-the-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, phone: "+15550000000" }),
    });
    expect(r.status).toBe(401);
    const after = await db().from("hl_inbound").select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });
});
