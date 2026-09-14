/*
 * HighLevel owns the customer; Supabase owns the work. This is the outbound
 * half of the wire between them: every customer, custom project and video
 * on our side becomes a contact, a deal card and a record in the studio's
 * HighLevel sub-account, and stays in step with it.
 *
 * How it runs. A trigger writes one row to hl_sync_outbox on every change
 * (migration 0095). drainOutbox reads the pending rows, builds each payload
 * from the LIVE row (never from the event), compares its fingerprint with
 * the last one sent, and only calls HighLevel when something differs. A
 * failure keeps the row with the error and a growing wait, so nothing is
 * lost while HighLevel is down and nothing is sent twice for one state.
 *
 * What goes where:
 *   customer -> contact       name, company, phone, a tag per service line
 *                             and eight custom fields (lines, arrangement,
 *                             retainer terms, source, last seen, the link
 *                             to their admin record, our id)
 *   project  -> opportunity   in "GHL Video: Custom projects", the stage is
 *                             our status, the value is the agreed price
 *            -> record        custom object GHLV Project, tied to the contact
 *   video    -> record        custom object GHLV Video, tied to the contact
 *                             of whichever of the three owners it hangs off
 *                             (an order, a project, or an editing cycle)
 *
 * On staging only accounts on the test allowlist are sent (see
 * syncAllowed), so a copy of production never writes real clients into the
 * sandbox. No "server-only" marker: npm run hl:sync runs this from a script.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HighLevelError, existingOpportunityId } from "@/lib/checkout/highlevel-errors";
import { hlFetch, locationId } from "./client";
import { HL_MANAGED_TAGS, HL_TAGS, loadHlConfig, type HlConfig, type LeadStageKey, type ProjectStageKey } from "./config";
import { parseRetainer, type Retainer } from "@/lib/retainer";
import { linesFrom, type ServiceLines } from "@/lib/portal-visibility";
import { isInvoiceProduct } from "@/lib/order-kind";
import { normalizeProjectStatus, STUDIO_LABEL } from "@/lib/projects";
import { ballInCourt, normalizePipeline } from "@/lib/pipeline";
import { syncInvoice, syncOrderSale, syncRetainerSchedule } from "./money";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

export type SyncKind = "customer" | "project" | "video" | "invoice" | "order" | "lead" | "partner";
export type Outcome = { status: "done" | "unchanged" | "skipped"; note: string };

/** Thrown inside a nested sync to say "not this one", never a failure. */
class SkipSync extends Error {}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ghlvideo.com").replace(/\/+$/, "");

/*
 * Who may be written to HighLevel from this environment.
 *
 * HIGHLEVEL_SYNC_ALLOW is a regular expression over the email. Unset on
 * staging it allows only the test accounts; unset anywhere else it allows
 * everyone. Set it to ".*" on staging to mirror the whole copy into the
 * sandbox on purpose.
 */
export function syncAllowed(email: string): boolean {
  const raw = process.env.HIGHLEVEL_SYNC_ALLOW;
  if (raw) {
    try {
      return new RegExp(raw, "i").test(email);
    } catch {
      return false;
    }
  }
  if (process.env.GHLV_ENV === "staging") return /@ghlvideo\.test$|@ghlvideo\.com$/i.test(email);
  return true;
}

export function fingerprint(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function splitName(name: unknown): { firstName?: string; lastName?: string } {
  if (typeof name !== "string" || !name.trim()) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const day = (iso: unknown) => (typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "");
const text = (v: unknown, max = 200) => (v === null || v === undefined ? "" : String(v).slice(0, max));

/** A phone HighLevel will accept, or nothing: it refuses the ones it cannot parse. */
function cleanPhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const p = v.trim();
  return /^\+?[\d\s().-]{7,20}$/.test(p) ? p : null;
}

/* ------------------------------------------------------------------ */
/* customer -> contact                                                 */
/* ------------------------------------------------------------------ */

export type CustomerShape = {
  lines: ServiceLines;
  retainer: Retainer | null;
  directBrief: boolean;
  internal: boolean;
  /** the latest editing plan, live or not, so the CRM can say which */
  plan: { name: string; status: string; renewsOn: string | null } | null;
  /** what the client owes us right now: a brief, a review, an approval, or nothing */
  waitingOn: "brief" | "review" | "approval" | "";
};

/** "Growth, active, renews 2026-10-02": the editing plan in one line. */
export function planLine(plan: CustomerShape["plan"]): string {
  if (!plan) return "";
  const name = plan.name.replace(/^Editing:\s*/i, "");
  const live = ["active", "trialing", "past_due"].includes(plan.status);
  return `${name}, ${plan.status.replace(/_/g, " ")}${live && plan.renewsOn ? `, renews ${plan.renewsOn}` : ""}`;
}

/** What the account is, in the words the CRM's custom field shows. */
export function arrangementOf(shape: CustomerShape): string {
  if (shape.retainer) return "Retainer partner";
  if (shape.lines.custom) return "Custom projects";
  if (shape.lines.editing) return "Editing plan";
  if (shape.lines.premade) return "Premade buyer";
  return "Lead";
}

/** The managed tags this account should carry. */
export function tagsFor(shape: CustomerShape): string[] {
  const tags: string[] = [];
  if (shape.lines.premade) tags.push(HL_TAGS.premade);
  if (shape.lines.custom) tags.push(HL_TAGS.custom);
  if (shape.lines.editing) tags.push(HL_TAGS.editing);
  if (shape.retainer) tags.push(HL_TAGS.retainer);
  if (shape.directBrief) tags.push(HL_TAGS.directBrief);
  if (!shape.lines.premade && !shape.lines.custom && !shape.lines.editing && !shape.retainer) tags.push(HL_TAGS.lead);
  if (shape.internal) tags.push(HL_TAGS.internal);
  if (shape.waitingOn) tags.push(HL_TAGS.waitingOnClient);
  return tags;
}

/** The upsert body for a contact, and the tags it should end up with. Pure. */
export function contactPayload(c: Row, shape: CustomerShape, cfg: HlConfig): { body: Row; tags: string[] } {
  const email = String(c.email ?? "").toLowerCase();
  const { firstName, lastName } = splitName(c.name);
  const f = cfg.contactFields;
  const lines = (["premade", "custom", "editing"] as const).filter((k) => shape.lines[k]);
  const fields: Record<string, string> = {
    [f.lines]: lines.join(", ") || "none yet",
    [f.arrangement]: arrangementOf(shape),
    [f.retainerFee]: shape.retainer ? `${money(shape.retainer.monthlyCents)} a month` : "",
    [f.retainerVideos]: shape.retainer
      ? `${shape.retainer.videosMin} to ${shape.retainer.videosMax} videos a month`
      : "",
    [f.source]: text(c.source, 40),
    [f.lastSeen]: day(c.last_seen_at),
    [f.adminUrl]: `${siteUrl()}/admin/customers/${c.id}/`,
    [f.customerId]: String(c.id),
    [f.editingPlan]: planLine(shape.plan),
    [f.waitingOn]: shape.waitingOn,
    [f.checkIn]: shape.retainer?.checkInOn ?? "",
    [f.retainerAgreed]: shape.retainer?.agreedOn
      ? `${shape.retainer.agreedOn.slice(0, 10)}${shape.retainer.agreedBy ? ` by ${shape.retainer.agreedBy}` : ""}`
      : "",
  };
  const body: Row = {
    locationId: cfg.locationId,
    email,
    source: "GHL Video platform",
    customFields: Object.entries(fields).map(([id, field_value]) => ({ id, field_value })),
  };
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (typeof c.company === "string" && c.company.trim()) body.companyName = c.company.trim().slice(0, 160);
  const phone = cleanPhone(c.phone);
  if (phone) body.phone = phone;
  return { body, tags: tagsFor(shape) };
}

/*
 * What the client owes us right now, in the order a workflow should nag:
 * a stage handed to them on a custom job, a video waiting for their review,
 * a paid order still without its brief. The contact carries the word and a
 * tag, so HighLevel's workflows can chase without our cron.
 */
async function waitingOnClient(db: Db, orders: Row[], projects: Row[], subs: Row[]): Promise<CustomerShape["waitingOn"]> {
  if (projects.some((p) => ballInCourt(normalizePipeline(p.pipeline)) === "client")) return "approval";
  const orderIds = orders.map((o) => String(o.id));
  const projectIds = projects.map((p) => String(p.id));
  const subIds = subs.map((s) => String(s.id)).filter(Boolean);
  const { data: cycles } = subIds.length
    ? await db.from("subscription_cycles").select("id").in("subscription_id", subIds)
    : { data: [] };
  const cycleIds = ((cycles ?? []) as Row[]).map((x) => String(x.id));
  const ors = [
    orderIds.length ? `order_id.in.(${orderIds.join(",")})` : "",
    projectIds.length ? `project_id.in.(${projectIds.join(",")})` : "",
    cycleIds.length ? `cycle_id.in.(${cycleIds.join(",")})` : "",
  ].filter(Boolean);
  if (ors.length) {
    const { count } = await db
      .from("order_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready")
      .or(ors.join(","));
    if ((count ?? 0) > 0) return "review";
  }
  if (orders.some((o) => !o.intake_completed)) return "brief";
  return "";
}

async function customerShape(db: Db, c: Row): Promise<CustomerShape> {
  const email = String(c.email ?? "").toLowerCase();
  const [{ data: orders }, { data: projectRows }, { data: subs }] = await Promise.all([
    db
      .from("orders")
      .select("id, status, intake_completed, product:products(metadata)")
      .ilike("customer_email", email)
      .eq("status", "paid"),
    db.from("projects").select("id, pipeline").ilike("customer_email", email).neq("status", "cancelled"),
    db
      .from("subscriptions")
      .select("id, plan_name, status, current_period_end, created_at")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
  ]);
  const orderRows = ((orders ?? []) as Row[]).filter(
    (o) => !isInvoiceProduct((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata),
  );
  const premadeOrders = orderRows.length;
  const projects = ((projectRows ?? []) as Row[]).length;
  const directBrief = Boolean(c.can_submit_projects);
  const subRows = (subs ?? []) as Row[];
  const waitingOn = await waitingOnClient(db, orderRows, (projectRows ?? []) as Row[], subRows);
  /* the live plan first, else the most recent one */
  const live = subRows.find((x) => ["active", "trialing", "past_due"].includes(String(x.status)));
  const latest = live ?? subRows[0] ?? null;
  return {
    lines: linesFrom({ premadeOrders, projects, directBrief, subscriptions: subRows.length }),
    retainer: parseRetainer(c.retainer),
    directBrief,
    internal: Boolean(c.internal),
    plan: latest
      ? {
          name: String(latest.plan_name ?? "Editing plan"),
          status: String(latest.status ?? ""),
          renewsOn: typeof latest.current_period_end === "string" ? latest.current_period_end.slice(0, 10) : null,
        }
      : null,
    waitingOn,
  };
}

async function upsertContact(body: Row): Promise<{ id: string; tags: string[]; isNew: boolean }> {
  const call = (b: Row) => hlFetch("/contacts/upsert", { method: "POST", body: JSON.stringify(b) });
  let j: Row;
  try {
    j = await call(body);
  } catch (e) {
    /* a phone HighLevel will not take is not worth losing the contact over */
    if (e instanceof HighLevelError && body.phone && e.status < 500 && /phone/i.test(e.message)) {
      const rest = { ...body };
      delete rest.phone;
      j = await call(rest);
    } else throw e;
  }
  const contact = (j.contact as Row) ?? j;
  const id = String(contact.id ?? "");
  if (!id) throw new Error(`HL upsert: no contact id in ${JSON.stringify(j).slice(0, 200)}`);
  return { id, tags: Array.isArray(contact.tags) ? (contact.tags as string[]) : [], isNew: Boolean(j.new) };
}

/*
 * Tags are added and removed through their own endpoints rather than sent
 * with the upsert, because the upsert's tag list is HighLevel's to define
 * and a tag the studio put on by hand must survive every sync. Only the
 * managed set is ever taken off.
 */
async function setManagedTags(contactId: string, have: string[], want: string[]) {
  const add = want.filter((t) => !have.includes(t));
  const remove = have.filter((t) => HL_MANAGED_TAGS.includes(t) && !want.includes(t));
  if (add.length) await hlFetch(`/contacts/${contactId}/tags`, { method: "POST", body: JSON.stringify({ tags: add }) });
  if (remove.length)
    await hlFetch(`/contacts/${contactId}/tags`, { method: "DELETE", body: JSON.stringify({ tags: remove }) });
}

export async function syncCustomer(db: Db, cfg: HlConfig, id: string): Promise<Outcome> {
  const { data: c } = await db.from("customers").select("*").eq("id", id).maybeSingle();
  if (!c) return { status: "skipped", note: "customer row is gone" };
  const email = String(c.email ?? "").toLowerCase();
  if (!syncAllowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };

  const shape = await customerShape(db, c);
  const { body, tags } = contactPayload(c, shape, cfg);
  const fp = fingerprint({ body, tags });
  const link = await getLink(db, cfg, "customer", id, "contact");
  if (link && link.fingerprint === fp) return { status: "unchanged", note: `contact ${link.hl_id}` };

  const contact = await upsertContact(body);
  await setManagedTags(contact.id, contact.tags, tags);
  await putLink(db, cfg, { kind: "customer", entity_id: id, hl_kind: "contact", hl_id: contact.id, fingerprint: fp });
  /* the legacy pointer the checkout webhook also writes; filled, never replaced */
  if (!c.highlevel_contact_id) await db.from("customers").update({ highlevel_contact_id: contact.id }).eq("id", id);
  /* the partnership's monthly bill lives in HighLevel as a schedule */
  const schedule = await syncRetainerSchedule(db, cfg, c, contact.id, fingerprint);
  return {
    status: "done",
    note: [`contact ${contact.id}${contact.isNew ? " (new)" : ""}`, ...(schedule ? [schedule] : [])].join("; "),
  };
}

/* ------------------------------------------------------------------ */
/* links                                                               */
/* ------------------------------------------------------------------ */

type HlKind = "contact" | "opportunity" | "record" | "invoice" | "schedule" | "estimate";
type Link = { hl_id: string; fingerprint: string | null };

async function getLink(db: Db, cfg: HlConfig, kind: SyncKind, entityId: string, hlKind: HlKind): Promise<Link | null> {
  const { data } = await db
    .from("hl_links")
    .select("hl_id, fingerprint, location_id")
    .eq("kind", kind)
    .eq("entity_id", entityId)
    .eq("hl_kind", hlKind)
    .maybeSingle();
  /* a link into another location (a copy of production's links on staging) is no link */
  if (!data || data.location_id !== cfg.locationId) return null;
  return { hl_id: String(data.hl_id), fingerprint: (data.fingerprint as string | null) ?? null };
}

async function putLink(
  db: Db,
  cfg: HlConfig,
  l: { kind: SyncKind; entity_id: string; hl_kind: HlKind; hl_id: string; fingerprint: string },
) {
  const { error } = await db
    .from("hl_links")
    .upsert({ ...l, location_id: cfg.locationId, synced_at: new Date().toISOString() }, { onConflict: "kind,entity_id,hl_kind" });
  if (error) throw new Error(`hl_links: ${error.message}`);
}

async function dropLink(db: Db, kind: SyncKind, entityId: string, hlKind: HlKind) {
  await db.from("hl_links").delete().match({ kind, entity_id: entityId, hl_kind: hlKind });
}

async function customerFor(db: Db, email: unknown, customerId: unknown): Promise<Row | null> {
  if (typeof customerId === "string" && customerId) {
    const { data } = await db.from("customers").select("*").eq("id", customerId).maybeSingle();
    if (data) return data;
  }
  if (typeof email !== "string" || !email) return null;
  const { data } = await db.from("customers").select("*").ilike("email", email).maybeSingle();
  return data ?? null;
}

/** The contact id for a customer, syncing them first when they have none yet. */
async function contactIdFor(db: Db, cfg: HlConfig, customer: Row): Promise<string> {
  const id = String(customer.id);
  const link = await getLink(db, cfg, "customer", id, "contact");
  if (link) return link.hl_id;
  const out = await syncCustomer(db, cfg, id);
  if (out.status === "skipped") throw new SkipSync(out.note);
  const again = await getLink(db, cfg, "customer", id, "contact");
  if (!again) throw new Error(`no contact link for customer ${id} after syncing it`);
  return again.hl_id;
}

/* ------------------------------------------------------------------ */
/* project -> opportunity + record                                     */
/* ------------------------------------------------------------------ */

export function projectPayload(p: Row, customer: Row, cfg: HlConfig) {
  const status = normalizeProjectStatus(String(p.status ?? "backlog"));
  const stageKey: ProjectStageKey = status === "cancelled" ? "closed" : status;
  const cents = Number(p.agreed_cents ?? p.quoted_cents ?? 0) || 0;
  const title = text(p.title, 150) || "Untitled project";
  const opportunity = {
    pipelineId: cfg.pipelines.projects.id,
    pipelineStageId: cfg.pipelines.projects.stages[stageKey],
    name: title,
    status: status === "closed" ? "won" : status === "cancelled" ? "lost" : "open",
    monetaryValue: Math.round(cents) / 100,
  };
  const record: Record<string, string> = {
    title,
    status: STUDIO_LABEL[status] ?? status,
    category: text(p.category, 80),
    agreed: cents ? money(cents) : "",
    due: day(p.due_at),
    brief: text(p.brief, 1000),
    admin_url: `${siteUrl()}/admin/customers/${customer.id}/`,
    project_id: String(p.id),
    retainer_month: text(p.retainer_month, 7),
    retainer_kind: text(p.retainer_kind, 20),
    client_email: String(customer.email ?? "").toLowerCase(),
  };
  return { opportunity, record };
}

async function upsertOpportunity(
  cfg: HlConfig,
  link: Link | null,
  opp: { pipelineId: string; pipelineStageId: string; name: string; status: string; monetaryValue: number },
  contactId: string,
  notes: string[],
): Promise<string> {
  const patch = {
    pipelineStageId: opp.pipelineStageId,
    status: opp.status,
    monetaryValue: opp.monetaryValue,
    name: opp.name,
  };
  if (link) {
    try {
      await hlFetch(`/opportunities/${link.hl_id}`, { method: "PUT", body: JSON.stringify(patch) });
      return link.hl_id;
    } catch (e) {
      if (!(e instanceof HighLevelError) || e.status !== 404) throw e;
      notes.push("the deal card had been deleted in HighLevel, made again");
    }
  }
  try {
    const j = await hlFetch("/opportunities/", {
      method: "POST",
      body: JSON.stringify({ locationId: cfg.locationId, contactId, ...opp }),
    });
    return String(((j.opportunity as Row) ?? j).id);
  } catch (e) {
    /*
     * One open deal per contact per pipeline unless the sub-account allows
     * duplicates (Settings, Business Profile, "Allow duplicate opportunity").
     * Until it does, the client's open card carries their latest project.
     */
    const existing = existingOpportunityId(e);
    if (!existing) throw e;
    notes.push("sharing the client's open deal card: the sub-account does not allow one deal per project yet");
    await hlFetch(`/opportunities/${existing}`, { method: "PUT", body: JSON.stringify(patch) });
    return existing;
  }
}

async function upsertRecord(
  cfg: HlConfig,
  objectKey: string,
  link: Link | null,
  properties: Record<string, string>,
  contactId: string,
  associationId: string,
  notes: string[],
): Promise<string> {
  const loc = encodeURIComponent(cfg.locationId);
  if (link) {
    try {
      await hlFetch(`/objects/${objectKey}/records/${link.hl_id}?locationId=${loc}`, {
        method: "PUT",
        body: JSON.stringify({ properties }),
      });
      return link.hl_id;
    } catch (e) {
      if (!(e instanceof HighLevelError) || e.status !== 404) throw e;
      notes.push("the record had been deleted in HighLevel, made again");
    }
  }
  const j = await hlFetch(`/objects/${objectKey}/records`, {
    method: "POST",
    body: JSON.stringify({ locationId: cfg.locationId, properties }),
  });
  const id = String(((j.record as Row) ?? j).id);
  await hlFetch("/associations/relations", {
    method: "POST",
    body: JSON.stringify({ locationId: cfg.locationId, associationId, firstRecordId: contactId, secondRecordId: id }),
  });
  return id;
}

export async function syncProject(db: Db, cfg: HlConfig, id: string): Promise<Outcome> {
  const { data: p } = await db.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) return { status: "skipped", note: "project row is gone" };
  const customer = await customerFor(db, p.customer_email, p.customer_id);
  if (!customer) return { status: "skipped", note: `no customer row for ${String(p.customer_email)}` };
  const email = String(customer.email ?? "").toLowerCase();
  if (!syncAllowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };

  const { opportunity, record } = projectPayload(p, customer, cfg);
  const fp = fingerprint({ opportunity, record });
  const [oppLink, recLink] = await Promise.all([
    getLink(db, cfg, "project", id, "opportunity"),
    getLink(db, cfg, "project", id, "record"),
  ]);
  if (oppLink && recLink && oppLink.fingerprint === fp && recLink.fingerprint === fp)
    return { status: "unchanged", note: `deal ${oppLink.hl_id}, record ${recLink.hl_id}` };

  const contactId = await contactIdFor(db, cfg, customer);
  const notes: string[] = [];
  const oppId = await upsertOpportunity(cfg, oppLink, opportunity, contactId, notes);
  await putLink(db, cfg, { kind: "project", entity_id: id, hl_kind: "opportunity", hl_id: oppId, fingerprint: fp });
  const recId = await upsertRecord(
    cfg,
    cfg.objects.project.key,
    recLink,
    record,
    contactId,
    cfg.associations.projectContact,
    notes,
  );
  await putLink(db, cfg, { kind: "project", entity_id: id, hl_kind: "record", hl_id: recId, fingerprint: fp });
  return { status: "done", note: [`deal ${oppId}`, `record ${recId}`, ...notes].join("; ") };
}

/* ------------------------------------------------------------------ */
/* video -> record                                                     */
/* ------------------------------------------------------------------ */

export type VideoKind = "premade" | "custom" | "editing";

/**
 * Whose video this is. A video hangs off an order, a custom project or an
 * editing cycle, and the client is found through whichever it has.
 */
export async function videoOwner(
  db: Db,
  v: Row,
): Promise<{ kind: VideoKind; email: string | null; customerId: string | null } | null> {
  if (v.order_id) {
    const { data: o } = await db
      .from("orders")
      .select("customer_email, customer_id")
      .eq("id", String(v.order_id))
      .maybeSingle();
    return { kind: "premade", email: (o?.customer_email as string | null) ?? null, customerId: (o?.customer_id as string | null) ?? null };
  }
  if (v.project_id) {
    const { data: p } = await db
      .from("projects")
      .select("customer_email, customer_id")
      .eq("id", String(v.project_id))
      .maybeSingle();
    return { kind: "custom", email: (p?.customer_email as string | null) ?? null, customerId: (p?.customer_id as string | null) ?? null };
  }
  if (v.cycle_id) {
    const { data: c } = await db
      .from("subscription_cycles")
      .select("subscription:subscriptions!inner(customer_email, customer_id)")
      .eq("id", String(v.cycle_id))
      .maybeSingle();
    const s = (c?.subscription as { customer_email?: string; customer_id?: string } | null) ?? null;
    return { kind: "editing", email: s?.customer_email ?? null, customerId: s?.customer_id ?? null };
  }
  return null;
}

export function videoPayload(v: Row, kind: VideoKind, customer: Row): Record<string, string> {
  return {
    title: text(v.title, 150) || "Untitled video",
    status: text(v.status, 40),
    kind,
    category: text(v.category, 80),
    position: v.position === null || v.position === undefined ? "" : String(v.position),
    video_url: typeof v.share_token === "string" && v.share_token ? `${siteUrl()}/v/${v.share_token}` : "",
    due: day(v.due_at),
    ready: day(v.ready_at),
    approved: day(v.approved_at),
    admin_url: `${siteUrl()}/admin/customers/${customer.id}/`,
    video_id: String(v.id),
    client_email: String(customer.email ?? "").toLowerCase(),
  };
}

export async function syncVideo(db: Db, cfg: HlConfig, id: string): Promise<Outcome> {
  const { data: v } = await db.from("order_deliverables").select("*").eq("id", id).maybeSingle();
  if (!v) return { status: "skipped", note: "video row is gone" };
  const owner = await videoOwner(db, v);
  if (!owner) return { status: "skipped", note: "video has no owner: no order, project or cycle" };
  const customer = await customerFor(db, owner.email, owner.customerId);
  if (!customer) return { status: "skipped", note: `no customer row for ${String(owner.email)}` };
  const email = String(customer.email ?? "").toLowerCase();
  if (!syncAllowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };

  const record = videoPayload(v, owner.kind, customer);
  const fp = fingerprint(record);
  const link = await getLink(db, cfg, "video", id, "record");
  if (link && link.fingerprint === fp) return { status: "unchanged", note: `record ${link.hl_id}` };

  const contactId = await contactIdFor(db, cfg, customer);
  const notes: string[] = [];
  const recId = await upsertRecord(cfg, cfg.objects.video.key, link, record, contactId, cfg.associations.videoContact, notes);
  await putLink(db, cfg, { kind: "video", entity_id: id, hl_kind: "record", hl_id: recId, fingerprint: fp });
  /* a video going out for review, or coming back, changes what the client is
     waiting on; the contact follows on the next pass (unchanged is free) */
  await enqueue(db, "customer", String(customer.id), "video changed").catch(() => undefined);
  return { status: "done", note: [`record ${recId}`, ...notes].join("; ") };
}

/* ------------------------------------------------------------------ */
/* lead -> contact + deal in the Leads pipeline                        */
/* ------------------------------------------------------------------ */

const LEAD_STAGE: Record<string, LeadStageKey> = { new: "new", contacted: "contacted", quoted: "quoted", won: "won", lost: "lost" };

/**
 * An enquiry from the quote form becomes a contact and a deal card in
 * "GHL Video: Leads", and the card follows the enquiry's status in admin.
 * When the enquiry becomes a client, the customer sync takes over the
 * contact; the lead card is marked won and left as the record of how
 * they arrived.
 */
export async function syncLead(db: Db, cfg: HlConfig, id: string): Promise<Outcome> {
  const { data: r } = await db.from("project_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return { status: "skipped", note: "enquiry row is gone" };
  const email = String(r.email ?? "").toLowerCase();
  if (!email) return { status: "skipped", note: "enquiry has no email" };
  if (!syncAllowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };
  const status = String(r.status ?? "new");
  const stageKey = LEAD_STAGE[status] ?? "new";
  const { firstName, lastName } = splitName(r.name);
  const body: Row = { locationId: cfg.locationId, email, source: "ghlvideo.com quote form" };
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  if (typeof r.company === "string" && r.company.trim()) body.companyName = r.company.trim().slice(0, 160);
  const phone = cleanPhone(r.phone);
  if (phone) body.phone = phone;
  const opportunity = {
    pipelineId: cfg.pipelines.leads.id,
    pipelineStageId: cfg.pipelines.leads.stages[stageKey],
    name: `Quote: ${text(r.company || r.name || email, 100)}`,
    status: status === "won" ? "won" : status === "lost" ? "lost" : "open",
    monetaryValue: 0,
  };
  const fp = fingerprint({ body, opportunity, brief: text(r.brief, 2000) });
  const link = await getLink(db, cfg, "lead", id, "opportunity");
  if (link && link.fingerprint === fp) return { status: "unchanged", note: `deal ${link.hl_id}` };

  const contact = await upsertContact(body);
  /* a lead who is already a client keeps the client's tags; a new one is marked a lead */
  const { data: customer } = await db.from("customers").select("id").ilike("email", email).maybeSingle();
  if (!customer) await setManagedTags(contact.id, contact.tags, [HL_TAGS.lead]);
  const notes: string[] = [];
  const oppId = await upsertOpportunity(cfg, link, opportunity, contact.id, notes);
  if (!link && typeof r.brief === "string" && r.brief.trim()) {
    await hlFetch(`/contacts/${contact.id}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: `Quote request from the website:\n\n${r.brief.trim().slice(0, 4000)}` }),
    });
  }
  await putLink(db, cfg, { kind: "lead", entity_id: id, hl_kind: "opportunity", hl_id: oppId, fingerprint: fp });
  return { status: "done", note: [`deal ${oppId}`, ...notes].join("; ") };
}

/* ------------------------------------------------------------------ */
/* partner -> contact                                                  */
/* ------------------------------------------------------------------ */

const TIER_NAME: Record<string, string> = {
  affiliate: "Affiliate Partner",
  vip: "VIP Affiliate Partner",
  partnership: "Partnership Program",
};

/**
 * A partner is a contact too, tagged, with their handle and tier on the
 * record, so the team sees them in the CRM with everyone else. The
 * program itself (commissions, payouts) stays where it runs.
 */
export async function syncPartner(db: Db, cfg: HlConfig, id: string): Promise<Outcome> {
  const { data: p } = await db.from("partners").select("*").eq("id", id).maybeSingle();
  if (!p) return { status: "skipped", note: "partner row is gone" };
  const email = String(p.email ?? "").toLowerCase();
  if (!email) return { status: "skipped", note: "partner has no email" };
  if (!syncAllowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };
  const { firstName, lastName } = splitName(p.name);
  const f = cfg.contactFields;
  const body: Row = {
    locationId: cfg.locationId,
    email,
    source: "GHL Video partner program",
    customFields: [
      { id: f.partnerRef, field_value: String(p.ref ?? "") },
      { id: f.partnerTier, field_value: TIER_NAME[String(p.tier)] ?? String(p.tier ?? "") },
    ],
  };
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  const active = ["active", "invited"].includes(String(p.status));
  const fp = fingerprint({ body, active });
  const link = await getLink(db, cfg, "partner", id, "contact");
  if (link && link.fingerprint === fp) return { status: "unchanged", note: `contact ${link.hl_id}` };
  const contact = await upsertContact(body);
  const add = active ? [HL_TAGS.partner] : [];
  const remove = active ? [] : [HL_TAGS.partner];
  if (add.length) await hlFetch(`/contacts/${contact.id}/tags`, { method: "POST", body: JSON.stringify({ tags: add }) });
  if (remove.length && contact.tags.includes(HL_TAGS.partner))
    await hlFetch(`/contacts/${contact.id}/tags`, { method: "DELETE", body: JSON.stringify({ tags: remove }) });
  await putLink(db, cfg, { kind: "partner", entity_id: id, hl_kind: "contact", hl_id: contact.id, fingerprint: fp });
  return { status: "done", note: `contact ${contact.id}${active ? "" : " (not active, untagged)"}` };
}

/* ------------------------------------------------------------------ */
/* a note on the contact: what happened, in a sentence                 */
/* ------------------------------------------------------------------ */

/**
 * One line on the client's contact for a moment worth keeping (a quote
 * sent or accepted, an agreement signed). Fail-soft: a note is a nicety,
 * never a reason to fail the thing it describes.
 */
export async function noteOnContact(db: Db, email: string, body: string): Promise<boolean> {
  try {
    if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) return false;
    const cfg = await loadHlConfig(db, locationId());
    const address = email.toLowerCase();
    if (!cfg || !syncAllowed(address)) return false;
    const { data: customer } = await db.from("customers").select("*").ilike("email", address).maybeSingle();
    let contactId: string;
    if (customer) contactId = await contactIdFor(db, cfg, customer);
    else {
      /* a lead has no customer row yet, only an enquiry; their contact is
         the one the lead sync made, found by email rather than made anew */
      const { count } = await db.from("project_requests").select("id", { count: "exact", head: true }).ilike("email", address);
      if (!count) return false;
      const contact = await upsertContact({ locationId: cfg.locationId, email: address });
      contactId = contact.id;
    }
    await hlFetch(`/contacts/${contactId}/notes`, { method: "POST", body: JSON.stringify({ body: body.slice(0, 4000) }) });
    return true;
  } catch (e) {
    console.error(`[highlevel] note for ${email} not written: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* the outbox                                                          */
/* ------------------------------------------------------------------ */

export async function syncEntity(db: Db, cfg: HlConfig, kind: SyncKind, id: string): Promise<Outcome> {
  const deps = {
    contactIdFor: (customer: Row) => contactIdFor(db, cfg, customer),
    allowed: syncAllowed,
    fingerprint,
  };
  try {
    if (kind === "customer") return await syncCustomer(db, cfg, id);
    if (kind === "project") return await syncProject(db, cfg, id);
    if (kind === "invoice") return await syncInvoice(db, cfg, id, deps);
    if (kind === "order") return await syncOrderSale(db, cfg, id, deps);
    if (kind === "lead") return await syncLead(db, cfg, id);
    if (kind === "partner") return await syncPartner(db, cfg, id);
    return await syncVideo(db, cfg, id);
  } catch (e) {
    if (e instanceof SkipSync) return { status: "skipped", note: e.message };
    throw e;
  }
}

export type DrainResult = {
  provisioned: boolean;
  processed: number;
  done: number;
  unchanged: number;
  skipped: number;
  failed: number;
  /** what each row came to, for the log and the tests */
  rows: { id: number; kind: SyncKind; entityId: string; status: Outcome["status"] | "failed"; note: string }[];
};

const KIND_ORDER: Record<SyncKind, number> = { customer: 0, project: 1, video: 2, invoice: 3, order: 4, lead: 5, partner: 6 };
const MAX_WAIT_S = 6 * 3600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send what is waiting. Customers go before projects before videos so a
 * project finds its contact already there. Each row is one entity; a
 * failure schedules that row again with a wait that doubles each time,
 * capped at six hours, and never blocks the rows behind it.
 */
export async function drainOutbox(db: Db, opts: { limit?: number; pauseMs?: number } = {}): Promise<DrainResult> {
  const result: DrainResult = { provisioned: true, processed: 0, done: 0, unchanged: 0, skipped: 0, failed: 0, rows: [] };
  const cfg = await loadHlConfig(db, locationId());
  if (!cfg) return { ...result, provisioned: false };

  const { data, error } = await db
    .from("hl_sync_outbox")
    .select("id, kind, entity_id, attempts")
    .is("done_at", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(opts.limit ?? 40);
  if (error) throw new Error(`hl_sync_outbox: ${error.message}`);
  const rows = ((data ?? []) as { id: number; kind: SyncKind; entity_id: string; attempts: number }[]).sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id - b.id,
  );

  for (const r of rows) {
    result.processed += 1;
    try {
      const out = await syncEntity(db, cfg, r.kind, r.entity_id);
      await db
        .from("hl_sync_outbox")
        .update({ done_at: new Date().toISOString(), attempts: r.attempts + 1, last_error: out.status === "skipped" ? out.note : null })
        .eq("id", r.id);
      result[out.status] += 1;
      result.rows.push({ id: r.id, kind: r.kind, entityId: r.entity_id, status: out.status, note: out.note });
    } catch (e) {
      const attempts = r.attempts + 1;
      const waitS = Math.min(MAX_WAIT_S, 60 * 2 ** attempts);
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await db
        .from("hl_sync_outbox")
        .update({ attempts, next_attempt_at: new Date(Date.now() + waitS * 1000).toISOString(), last_error: message })
        .eq("id", r.id);
      result.failed += 1;
      result.rows.push({ id: r.id, kind: r.kind, entityId: r.entity_id, status: "failed", note: message });
    }
    /* HighLevel allows a burst of 100 calls per 10 seconds per location */
    if (opts.pauseMs !== 0) await sleep(opts.pauseMs ?? 120);
  }
  return result;
}

/** Queue one entity by hand (a screen, a script, the reconcile). */
export async function enqueue(db: Db, kind: SyncKind, id: string, reason: string) {
  const { error } = await db.rpc("hl_enqueue", { p_kind: kind, p_entity: id, p_reason: reason });
  if (error) throw new Error(`hl_enqueue: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* reconcile: the nightly "is anything adrift"                          */
/* ------------------------------------------------------------------ */

export type ReconcileResult = {
  provisioned: boolean;
  /** rows queued because they had no link, or changed since the last send */
  enqueued: Record<SyncKind, number>;
  /** links checked against HighLevel, and how many pointed at nothing */
  verified: number;
  missing: number;
  /** outbox rows still waiting, and the ones that have failed three times or more */
  pending: number;
  stuck: number;
};

const LINK_OF: Record<SyncKind, { table: string; hlKind: HlKind }> = {
  customer: { table: "customers", hlKind: "contact" },
  project: { table: "projects", hlKind: "opportunity" },
  video: { table: "order_deliverables", hlKind: "record" },
  invoice: { table: "invoices", hlKind: "invoice" },
  order: { table: "orders", hlKind: "invoice" },
  lead: { table: "project_requests", hlKind: "opportunity" },
  partner: { table: "partners", hlKind: "contact" },
};

async function stillThere(cfg: HlConfig, l: { kind: SyncKind; hl_kind: HlKind; hl_id: string }): Promise<boolean> {
  const loc = encodeURIComponent(cfg.locationId);
  const alt = `altId=${loc}&altType=location`;
  const path =
    l.hl_kind === "contact"
      ? `/contacts/${l.hl_id}`
      : l.hl_kind === "opportunity"
        ? `/opportunities/${l.hl_id}`
        : l.hl_kind === "invoice"
          ? `/invoices/${l.hl_id}?${alt}`
          : l.hl_kind === "schedule"
            ? `/invoices/schedule/${l.hl_id}?${alt}`
            : l.hl_kind === "estimate"
              ? `/invoices/estimate/list?${alt}&limit=1&offset=0`
              : `/objects/${l.kind === "project" ? cfg.objects.project.key : cfg.objects.video.key}/records/${l.hl_id}?locationId=${loc}`;
  try {
    await hlFetch(path, { method: "GET" });
    return true;
  } catch (e) {
    if (e instanceof HighLevelError && e.status === 404) return false;
    /* anything else is HighLevel having a moment, not a missing record */
    return true;
  }
}

/**
 * Queue everything that has no link or changed after its last send, then
 * check a rotating slice of the links against HighLevel and re-queue the
 * ones that point at something deleted over there. Read-only on HighLevel.
 */
export async function reconcile(db: Db, opts: { verify?: number } = {}): Promise<ReconcileResult> {
  const loc = locationId();
  const cfg = await loadHlConfig(db, loc);
  const result: ReconcileResult = {
    provisioned: Boolean(cfg),
    enqueued: { customer: 0, project: 0, video: 0, invoice: 0, order: 0, lead: 0, partner: 0 },
    verified: 0,
    missing: 0,
    pending: 0,
    stuck: 0,
  };
  if (!cfg) return result;

  for (const kind of ["customer", "project", "video", "invoice", "order", "lead", "partner"] as SyncKind[]) {
    const { table, hlKind } = LINK_OF[kind];
    /* orders: only paid ones are sales to record (legacy invoice payments are
       skipped by the sync itself); invoices: a void one has nothing over there */
    const base = db.from(table).select("id, updated_at");
    const scoped = kind === "order" ? base.eq("status", "paid") : kind === "invoice" ? base.neq("status", "void") : base;
    const [{ data: rows }, { data: links }] = await Promise.all([
      scoped.order("updated_at", { ascending: false }).limit(5000),
      db.from("hl_links").select("entity_id, synced_at").eq("kind", kind).eq("hl_kind", hlKind).eq("location_id", loc),
    ]);
    const synced = new Map(((links ?? []) as Row[]).map((l) => [String(l.entity_id), String(l.synced_at)]));
    for (const r of (rows ?? []) as Row[]) {
      const s = synced.get(String(r.id));
      if (!s || (typeof r.updated_at === "string" && r.updated_at > s)) {
        await enqueue(db, kind, String(r.id), "reconcile");
        result.enqueued[kind] += 1;
      }
    }
  }

  const n = opts.verify ?? 25;
  const { count: total } = await db.from("hl_links").select("kind", { count: "exact", head: true }).eq("location_id", loc);
  if (n > 0 && (total ?? 0) > 0) {
    /* a different slice each day, so every link is looked at in turn */
    const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 86400000);
    const offset = ((dayOfYear * n) % Math.max(total ?? 1, 1)) || 0;
    const { data: slice } = await db
      .from("hl_links")
      .select("kind, entity_id, hl_kind, hl_id")
      .eq("location_id", loc)
      .order("kind")
      .order("entity_id")
      .range(offset, offset + n - 1);
    for (const l of (slice ?? []) as { kind: SyncKind; entity_id: string; hl_kind: HlKind; hl_id: string }[]) {
      result.verified += 1;
      if (await stillThere(cfg, l)) continue;
      result.missing += 1;
      await dropLink(db, l.kind, l.entity_id, l.hl_kind);
      await enqueue(db, l.kind, l.entity_id, "reconcile: gone in HighLevel");
      await sleep(120);
    }
  }

  const [{ count: pending }, { count: stuck }] = await Promise.all([
    db.from("hl_sync_outbox").select("id", { count: "exact", head: true }).is("done_at", null),
    db.from("hl_sync_outbox").select("id", { count: "exact", head: true }).is("done_at", null).gte("attempts", 3),
  ]);
  result.pending = pending ?? 0;
  result.stuck = stuck ?? 0;
  return result;
}
