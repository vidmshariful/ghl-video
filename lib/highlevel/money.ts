/*
 * Money in HighLevel (phase 3). HighLevel raises the invoice, hosts the pay
 * page, takes the card through the studio's Stripe connection and keeps the
 * ledger. This module keeps our mirror in step with it, both ways:
 *
 *   invoice  -> HighLevel invoice   raised in admin, created and sent there,
 *                                  edited or voided there when we change it
 *   order    -> paid invoice        a premade sale paid on the site, recorded
 *                                  on the contact with its Stripe reference;
 *                                  refunded, the invoice is voided if it was
 *                                  never paid there and the contact gets a note
 *   retainer -> recurring schedule  the partnership's monthly bill, on the 1st
 *   HighLevel -> invoices           what happens over there comes back: paid,
 *                                  viewed, void, and invoices made by hand or
 *                                  by the schedule
 *   products -> products            the catalogue, so an invoice can pick from it
 *
 * Amounts: HighLevel speaks dollars with decimals; we speak integer cents.
 * The conversion happens here and nowhere else. No "server-only" marker:
 * the scripts run this too.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { HighLevelError } from "@/lib/checkout/highlevel-errors";
import { hlFetch } from "./client";
import type { HlConfig } from "./config";
import { parseRetainer, type Retainer } from "@/lib/retainer";
import { likeLiteral } from "@/lib/pg-pattern";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

export type Outcome = { status: "done" | "unchanged" | "skipped"; note: string };
type Link = { hl_id: string; fingerprint: string | null };
export type Contact = { id: string; name: string; email: string };

/** The client's pay page for an invoice, the same link HighLevel puts in its emails. */
export const invoiceUrl = (hlInvoiceId: string) => `https://link.msgsndr.com/invoice/${hlInvoiceId}`;

const BUSINESS = { name: "Vidiosa LLC" };
const alt = (cfg: HlConfig) => ({ altId: cfg.locationId, altType: "location" as const });
const q = (cfg: HlConfig) => `altId=${encodeURIComponent(cfg.locationId)}&altType=location`;
export const dollars = (cents: number) => Math.round(cents) / 100;
export const cents = (dollarsIn: unknown) => Math.round(Number(dollarsIn || 0) * 100);
/** "$1,500" or "$441.50": the words for an amount, the way the emails say it. */
export const moneyText = (amountCents: number, currency = "usd") =>
  (amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  });
const day = (v: unknown) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : new Date().toISOString().slice(0, 10));
/**
 * HighLevel refuses a due date that has passed, judged on the sub-account's
 * own clock, which can be a day ahead of UTC (the sandbox is on Dhaka time:
 * "today" in UTC was already yesterday there at 21:00, and a bill raised in
 * that hour was refused). A bill raised late is therefore due tomorrow, in
 * UTC terms, which is never behind any clock on earth.
 */
export const dueDay = (v: unknown, today = new Date().toISOString().slice(0, 10)) => {
  const d = day(v);
  const floor = new Date(Date.parse(`${today}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
  return d < floor ? floor : d;
};
const text = (v: unknown, max: number) => (v === null || v === undefined ? "" : String(v).slice(0, max));

/** Test-mode billing everywhere but production. */
export const liveMode = () => process.env.HIGHLEVEL_LIVE_MODE === "true";

/** The sub-account user invoices go out as; a token has no user of its own. */
export function senderUserId(): string | null {
  return process.env.HIGHLEVEL_USER_ID || null;
}

/** "email": HighLevel mails the client its pay link. "send_manually": marked sent, nothing mailed. */
export function sendAction(): "email" | "send_manually" {
  const a = process.env.HIGHLEVEL_SEND_ACTION;
  if (a === "email" || a === "send_manually") return a;
  return process.env.GHLV_ENV === "staging" ? "send_manually" : "email";
}

/* ------------------------------------------------------------------ */
/* the invoice payload                                                 */
/* ------------------------------------------------------------------ */

export type LineItem = { description: string; amount_cents: number; quantity?: number; unit_cents?: number };

/** The body HighLevel takes to create an invoice from one of our rows. Pure. */
export function invoicePayload(inv: Row, contact: Contact, cfg: HlConfig) {
  const lines = (Array.isArray(inv.line_items) ? (inv.line_items as LineItem[]) : []).filter(
    (l) => l && l.description && Number(l.amount_cents) > 0,
  );
  const items = lines.map((l) => {
    const qty = Math.max(1, Math.round(Number(l.quantity ?? 1)));
    const unit = Number(l.unit_cents ?? Math.round(Number(l.amount_cents) / qty));
    return { name: text(l.description, 150), currency: "USD", amount: dollars(unit), qty };
  });
  const kind = inv.discount_kind;
  const value = Number(inv.discount_value ?? 0);
  const discount =
    kind === "percent" && value > 0
      ? { type: "percentage", value: Math.min(100, value) }
      : kind === "flat" && value > 0
        ? { type: "fixed", value: dollars(value) }
        : { type: "percentage", value: 0 };
  const first = lines[0]?.description ? `: ${text(lines[0].description, 80)}` : "";
  return {
    ...alt(cfg),
    name: `${text(inv.number, 40)}${first}`,
    title: "INVOICE",
    currency: "USD",
    businessDetails: BUSINESS,
    contactDetails: contact,
    items,
    discount,
    issueDate: day(inv.created_at),
    dueDate: dueDay(inv.due_date ?? inv.created_at),
    sentTo: { email: [contact.email] },
    liveMode: liveMode(),
    ...(typeof inv.notes === "string" && inv.notes.trim() ? { termsNotes: inv.notes.trim().slice(0, 4000) } : {}),
  };
}

/** What HighLevel's copy of an invoice says, as columns on our row. Pure. */
export function invoiceStateFrom(hl: Row): Row {
  const status = String(hl.status ?? "");
  const paid = status === "paid";
  const patch: Row = {
    hl_status: status,
    hl_number: hl.invoiceNumber ? `${text(hl.invoiceNumberPrefix, 10)}${text(hl.invoiceNumber, 20)}` : null,
    amount_paid_cents: cents(hl.amountPaid),
    hl_url: invoiceUrl(String(hl._id ?? hl.id)),
    updated_at: new Date().toISOString(),
  };
  if (paid) patch.paid_at = typeof hl.lastPaidAt === "string" ? hl.lastPaidAt : new Date().toISOString();
  else if (status === "void" || status === "voided" || status === "refunded") patch.paid_at = null;
  if (status === "void" || status === "voided") {
    patch.status = "void";
    patch.hl_status = "void";
  }
  return patch;
}

/* ------------------------------------------------------------------ */
/* links and lookups (the same table the customer sync uses)           */
/* ------------------------------------------------------------------ */

async function getLink(db: Db, cfg: HlConfig, kind: string, entityId: string, hlKind: string): Promise<Link | null> {
  const { data } = await db
    .from("hl_links")
    .select("hl_id, fingerprint, location_id")
    .eq("kind", kind)
    .eq("entity_id", entityId)
    .eq("hl_kind", hlKind)
    .maybeSingle();
  if (!data || data.location_id !== cfg.locationId) return null;
  return { hl_id: String(data.hl_id), fingerprint: (data.fingerprint as string | null) ?? null };
}

async function putLink(db: Db, cfg: HlConfig, l: { kind: string; entity_id: string; hl_kind: string; hl_id: string; fingerprint: string }) {
  const { error } = await db
    .from("hl_links")
    .upsert({ ...l, location_id: cfg.locationId, synced_at: new Date().toISOString() }, { onConflict: "kind,entity_id,hl_kind" });
  if (error) throw new Error(`hl_links: ${error.message}`);
}

async function dropLink(db: Db, kind: string, entityId: string, hlKind: string) {
  await db.from("hl_links").delete().match({ kind, entity_id: entityId, hl_kind: hlKind });
}

/** The customer behind a contact id, through the customer link. */
export async function customerByContact(db: Db, cfg: HlConfig, contactId: string): Promise<Row | null> {
  const { data: link } = await db
    .from("hl_links")
    .select("entity_id")
    .eq("kind", "customer")
    .eq("hl_kind", "contact")
    .eq("hl_id", contactId)
    .eq("location_id", cfg.locationId)
    .maybeSingle();
  if (!link) return null;
  const { data } = await db.from("customers").select("*").eq("id", String(link.entity_id)).maybeSingle();
  return data ?? null;
}

export function contactOf(customer: Row, contactId: string): Contact {
  return {
    id: contactId,
    name: text(customer.name || customer.company || customer.email, 120),
    email: String(customer.email ?? "").toLowerCase(),
  };
}

/* ------------------------------------------------------------------ */
/* our invoice -> HighLevel                                            */
/* ------------------------------------------------------------------ */

export async function fetchInvoice(cfg: HlConfig, hlId: string): Promise<Row | null> {
  try {
    return await hlFetch(`/invoices/${hlId}?${q(cfg)}`, { method: "GET" });
  } catch (e) {
    if (e instanceof HighLevelError && e.status === 404) return null;
    throw e;
  }
}

/** Write what HighLevel says onto our row. */
export async function applyInvoiceState(db: Db, rowId: string, hl: Row): Promise<Row> {
  const patch = invoiceStateFrom(hl);
  await db.from("invoices").update(patch).eq("id", rowId);
  return patch;
}

/**
 * Money arrived on HighLevel's pay page: the client gets the receipt and the
 * bell a payment on the site gets, and the team is told. Until now a payment
 * made there told nobody (audit, 15 September 2026).
 *
 * The words are the invoice branch of sendOrderPaidEmails in
 * lib/email/notify.ts, which is keyed by an order this payment does not
 * have; the same template keys, bell kinds and links are used here so the
 * two paths read the same. Reached by dynamic import because those modules
 * are server-only and this one also runs from npm run hl:sync. Money carries
 * no email preference category, so nothing is held back. Fail-soft: the paid
 * mark already stands.
 */
export async function notifyInvoicePaid(db: Db, invoiceId: string): Promise<boolean> {
  try {
    const { data: inv } = await db
      .from("invoices")
      .select("number, total_cents, amount_paid_cents, currency, customer_email, customer_name")
      .eq("id", invoiceId)
      .maybeSingle();
    const email = String(inv?.customer_email ?? "").toLowerCase();
    if (!inv || !email) return false;
    const [{ loadTemplate }, { sendEmail }, { renderTemplate, wrapEmail, escapeHtml, SITE_URL }, { pushNotification, pushAdminNotifications }] =
      await Promise.all([import("@/lib/email/notify"), import("@/lib/email/send"), import("@/lib/email/templates"), import("@/lib/notifications")]);
    const { data: c } = await db.from("customers").select("name").ilike("email", likeLiteral(email)).maybeSingle();
    const name = (c?.name as string | null) ?? (inv.customer_name as string | null) ?? null;
    const paidCents = Number(inv.amount_paid_cents) > 0 ? Number(inv.amount_paid_cents) : Number(inv.total_cents ?? 0);
    const amount = moneyText(paidCents, String(inv.currency ?? "usd"));
    const number = String(inv.number ?? "");
    const vars = {
      customer_name: escapeHtml(name || "there"),
      customer_email: escapeHtml(email),
      invoice_number: escapeHtml(number),
      amount,
      portal_url: `${SITE_URL}/portal`,
      admin_url: `${SITE_URL}/admin`,
    };
    const send = async (key: string, to: string, toName: string | null) => {
      const tpl = await loadTemplate(db, key);
      if (!tpl?.enabled) return;
      await sendEmail({
        to,
        toName,
        subject: renderTemplate(tpl.subject, vars),
        html: wrapEmail(renderTemplate(tpl.body, vars)),
        log: { source: "template", templateKey: key, meta: { invoice_id: invoiceId, paid_in: "highlevel" } },
      });
    };
    await send("invoice_paid", email, name);
    await send("admin_invoice_paid", process.env.ADMIN_ALERT_EMAIL ?? "hi@ghlvideo.com", null);
    const bell = { invoice_number: number, amount, customer_email: email };
    await pushNotification(db, {
      audience: "customer",
      email,
      kind: "invoice_paid",
      title: "Payment received",
      body: `${number}, ${amount}. Thank you, nothing else is needed.`,
      href: "orders",
      feature: "orders",
      vars: bell,
    });
    await pushAdminNotifications(db, {
      kind: "invoice_paid",
      title: `Invoice payment: ${amount}`,
      body: `${number} from ${email}`,
      href: "invoices",
      vars: bell,
    });
    return true;
  } catch (e) {
    console.error(`[highlevel] invoice ${invoiceId} paid there, receipt not sent: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/**
 * Why an invoice is not for HighLevel at all. Pure.
 *
 * The demo account's invoices are props for the demo portal, and a bill for
 * nothing has no line HighLevel will accept ("items should not be empty",
 * found at go-live on 15 September 2026 when the first fill tried to send
 * DEMO-INV-01). Neither is money.
 */
export function invoiceSkipReason(inv: Row, customer: Row): string | null {
  if (customer.internal) return "the studio's own demo account is never billed";
  if (!(Number(inv.total_cents) > 0)) return "nothing to bill: the total is zero";
  return null;
}

/**
 * One of our invoices, kept in step with HighLevel: made there when it is
 * new, sent when we mark it sent, updated when we edit it, voided when we
 * void it, and its paid state read back every time.
 */
export async function syncInvoice(
  db: Db,
  cfg: HlConfig,
  id: string,
  deps: { contactIdFor: (customer: Row) => Promise<string>; allowed: (email: string) => boolean; fingerprint: (v: unknown) => string },
): Promise<Outcome> {
  const { data: inv } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) return { status: "skipped", note: "invoice row is gone" };
  if (inv.source === "highlevel") return { status: "unchanged", note: "authored in HighLevel; it leads" };
  if (inv.product_id && !inv.hl_invoice_id)
    return { status: "skipped", note: "a legacy invoice billed through checkout; npm run hl:migrate-invoices moves it" };
  const email = String(inv.customer_email ?? "").toLowerCase();
  if (!email) return { status: "skipped", note: "invoice has no client email" };
  if (!deps.allowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };

  const { data: customer } = await db.from("customers").select("*").ilike("email", likeLiteral(email)).maybeSingle();
  if (!customer) return { status: "skipped", note: `no customer row for ${email}` };
  const why = invoiceSkipReason(inv, customer);
  if (why) return { status: "skipped", note: why };

  const contactId = await deps.contactIdFor(customer);
  const contact = contactOf(customer, contactId);
  const payload = invoicePayload(inv, contact, cfg);
  const wantSent = Boolean(inv.sent_at);
  const wantVoid = inv.status === "void";
  const fp = deps.fingerprint({ payload, wantSent, wantVoid });
  const link = await getLink(db, cfg, "invoice", id, "invoice");
  const notes: string[] = [];

  let hlId = link?.hl_id ?? (typeof inv.hl_invoice_id === "string" ? inv.hl_invoice_id : null);
  let hl: Row | null = null;

  if (!hlId) {
    if (wantVoid) return { status: "skipped", note: "void before it reached HighLevel; nothing to make" };
    hl = await hlFetch("/invoices/", { method: "POST", body: JSON.stringify(payload) });
    hlId = String(hl._id ?? hl.id);
    notes.push(`made ${hlId}`);
    await db.from("invoices").update({ hl_invoice_id: hlId, ...invoiceStateFrom(hl) }).eq("id", id);
  } else if (!link || link.fingerprint !== fp) {
    hl = await fetchInvoice(cfg, hlId);
    if (!hl) {
      /* deleted over there: a draft that was never sent can be made again */
      if (wantVoid) notes.push("gone in HighLevel and void here; nothing to do");
      else {
        hl = await hlFetch("/invoices/", { method: "POST", body: JSON.stringify(payload) });
        hlId = String(hl._id ?? hl.id);
        notes.push(`had been deleted in HighLevel; made again as ${hlId}`);
        await db.from("invoices").update({ hl_invoice_id: hlId, ...invoiceStateFrom(hl) }).eq("id", id);
      }
    } else {
      const hlStatus = String(hl.status ?? "");
      if (wantVoid && hlStatus !== "void") {
        if (hlStatus === "draft") {
          await hlFetch(`/invoices/${hlId}?${q(cfg)}`, { method: "DELETE" });
          notes.push("draft deleted in HighLevel");
          hl = { ...hl, status: "void" };
        } else if (hlStatus === "paid" || hlStatus === "partially_paid") {
          notes.push("paid in HighLevel, so not voided there; refund it first");
        } else {
          hl = await hlFetch(`/invoices/${hlId}/void`, { method: "POST", body: JSON.stringify(alt(cfg)) });
          notes.push("voided in HighLevel");
        }
      } else if (!wantVoid && (hlStatus === "draft" || hlStatus === "sent" || hlStatus === "viewed" || hlStatus === "overdue")) {
        /* edited here: HighLevel takes the same body under a different item key */
        const { items, ...rest } = payload;
        hl = await hlFetch(`/invoices/${hlId}`, { method: "PUT", body: JSON.stringify({ ...rest, invoiceItems: items }) });
        notes.push("updated in HighLevel");
      }
    }
  }

  if (hlId && wantSent && !inv.hl_sent_at && !wantVoid) {
    const userId = senderUserId();
    if (!userId) notes.push("not sent: HIGHLEVEL_USER_ID is unset");
    else {
      const current = hl ?? (await fetchInvoice(cfg, hlId));
      if (current && String(current.status) === "draft") {
        const sent = await hlFetch(`/invoices/${hlId}/send`, {
          method: "POST",
          body: JSON.stringify({ ...alt(cfg), userId, action: sendAction(), liveMode: liveMode() }),
        });
        hl = (sent.invoice as Row) ?? current;
        notes.push(sendAction() === "email" ? "sent by HighLevel, with its pay link" : "marked sent in HighLevel");
      }
      await db.from("invoices").update({ hl_sent_at: new Date().toISOString() }).eq("id", id);
    }
  }

  if (hlId) {
    const fresh = hl ?? (await fetchInvoice(cfg, hlId));
    if (fresh) await applyInvoiceState(db, id, fresh);
    /* HighLevel stops answering for a voided or deleted invoice, so the link
       goes too: the nightly check would otherwise read it as drift forever */
    if (wantVoid) await dropLink(db, "invoice", id, "invoice");
    else await putLink(db, cfg, { kind: "invoice", entity_id: id, hl_kind: "invoice", hl_id: hlId, fingerprint: fp });
  }
  if (!notes.length) return { status: "unchanged", note: `invoice ${hlId}` };
  return { status: "done", note: [`invoice ${hlId}`, ...notes].join("; ") };
}

/**
 * Read the state of every mirrored invoice still owed back from HighLevel:
 * paid, viewed, void. One GET per invoice, so a client paying on HighLevel's
 * page shows paid here within the minute, and gets their receipt.
 *
 * Watched by paid_at rather than by our status: a row voided here while
 * HighLevel's copy is still open keeps being read until the void lands over
 * there, so the two never disagree for good (audit, 15 September 2026).
 * HighLevel's own terminal states end the watch.
 */
export async function pollOpenInvoices(
  db: Db,
  cfg: HlConfig,
  opts: { limit?: number; until?: number } = {},
): Promise<{ checked: number; paid: number; changed: number; failed: number; failure: string | null; outOfTime: boolean }> {
  const { data } = await db
    .from("invoices")
    .select("id, hl_invoice_id, hl_status, amount_paid_cents")
    .not("hl_invoice_id", "is", null)
    .is("paid_at", null)
    .or("hl_status.is.null,hl_status.not.in.(void,voided,refunded)")
    .order("updated_at", { ascending: true })
    .limit(opts.limit ?? 50);
  const out = { checked: 0, paid: 0, changed: 0, failed: 0, failure: null as string | null, outOfTime: false };
  for (const r of (data ?? []) as Row[]) {
    if (opts.until && Date.now() > opts.until) {
      out.outOfTime = true;
      break;
    }
    /* One invoice HighLevel cannot answer for right now is left for the
       next minute; it used to end the whole run and raise a crash alarm
       (four times, 14 and 15 September 2026). */
    let hl: Row | null;
    try {
      hl = await fetchInvoice(cfg, String(r.hl_invoice_id));
    } catch (e) {
      out.failed += 1;
      out.failure = out.failure ?? (e instanceof Error ? e.message : String(e));
      continue;
    }
    out.checked += 1;
    if (!hl) continue;
    const status = String(hl.status ?? "");
    if (status !== String(r.hl_status ?? "") || cents(hl.amountPaid) !== Number(r.amount_paid_cents ?? 0)) {
      const patch = await applyInvoiceState(db, String(r.id), hl);
      out.changed += 1;
      if (status === "paid") out.paid += 1;
      /* the row had no paid_at a moment ago: this is the payment landing */
      if (patch.paid_at) await notifyInvoicePaid(db, String(r.id));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* HighLevel -> our mirror: invoices we did not raise                  */
/* ------------------------------------------------------------------ */

/** The invoice ids a retainer schedule has generated, by schedule id. */
async function scheduleInvoiceIds(cfg: HlConfig, scheduleIds: string[]): Promise<Map<string, string>> {
  const bySchedule = new Map<string, string>();
  for (const sid of scheduleIds) {
    try {
      const s = await hlFetch(`/invoices/schedule/${sid}?${q(cfg)}`, { method: "GET" });
      for (const inv of (s.invoices as unknown[]) ?? []) {
        const id = typeof inv === "string" ? inv : String((inv as Row)?._id ?? (inv as Row)?.id ?? "");
        if (id) bySchedule.set(id, sid);
      }
    } catch {
      /* a schedule we cannot read is not a reason to stop importing */
    }
  }
  return bySchedule;
}

/**
 * Bring across invoices that exist in HighLevel and not here: made by hand
 * in the sub-account, or generated by a retainer schedule. They get a
 * mirror row with source "highlevel", which our screens show and never
 * edit; HighLevel leads for them.
 */
export async function pullInvoices(
  db: Db,
  cfg: HlConfig,
  opts: { pages?: number } = {},
): Promise<{ seen: number; foreign: number; imported: number; skipped: string[] }> {
  const out = { seen: 0, foreign: 0, imported: 0, skipped: [] as string[] };
  const pages = opts.pages ?? 3;
  const listed: Row[] = [];
  for (let page = 0; page < pages; page += 1) {
    const j = await hlFetch(`/invoices/?${q(cfg)}&limit=100&offset=${page * 100}`, { method: "GET" });
    const rows = (j.invoices as Row[]) ?? [];
    listed.push(...rows);
    if (rows.length < 100) break;
  }
  out.seen = listed.length;
  if (!listed.length) return out;

  /* the sub-account bills other people too. An invoice whose contact email
     is not one of our clients' is counted and left alone before any query:
     every one of them was costing two reads and a "skipped" line a minute
     (audit, 15 September 2026). A contact with no email at all is still
     tried through its link. */
  const { data: clients } = await db.from("customers").select("email");
  const ours = new Set(((clients ?? []) as Row[]).map((c) => String(c.email ?? "").toLowerCase()).filter(Boolean));
  const emailOf = (i: Row) => String(((i.contactDetails as Row | null) ?? {}).email ?? "").toLowerCase();
  const candidates = listed.filter((i) => {
    const e = emailOf(i);
    if (e && !ours.has(e)) {
      out.foreign += 1;
      return false;
    }
    return true;
  });
  if (!candidates.length) return out;

  const ids = candidates.map((i) => String(i._id ?? i.id));
  const { data: have } = await db.from("invoices").select("hl_invoice_id").in("hl_invoice_id", ids);
  const known = new Set(((have ?? []) as Row[]).map((r) => String(r.hl_invoice_id)));
  const { data: linkedOrders } = await db.from("orders").select("hl_invoice_id").in("hl_invoice_id", ids);
  for (const o of (linkedOrders ?? []) as Row[]) known.add(String(o.hl_invoice_id));
  const missing = candidates.filter((i) => !known.has(String(i._id ?? i.id)));
  if (!missing.length) return out;

  const { data: partners } = await db.from("customers").select("id, hl_retainer_schedule_id").not("hl_retainer_schedule_id", "is", null);
  const scheduleIds = ((partners ?? []) as Row[]).map((p) => String(p.hl_retainer_schedule_id));
  const fromSchedule = scheduleIds.length ? await scheduleInvoiceIds(cfg, scheduleIds) : new Map<string, string>();

  for (const hl of missing) {
    const hlId = String(hl._id ?? hl.id);
    const contact = (hl.contactDetails as Row | null) ?? null;
    const contactId = contact?.id ? String(contact.id) : null;
    const email = String(contact?.email ?? "").toLowerCase();
    let customer: Row | null = contactId ? await customerByContact(db, cfg, contactId) : null;
    if (!customer && email) {
      const { data } = await db.from("customers").select("*").ilike("email", likeLiteral(email)).maybeSingle();
      customer = data ?? null;
    }
    if (!customer) {
      out.skipped.push(`${hlId}: no client for ${email || contactId || "unknown contact"}`);
      continue;
    }
    const items = ((hl.invoiceItems as Row[]) ?? []).map((it) => {
      const qty = Math.max(1, Math.round(Number(it.qty ?? 1)));
      const unit = cents(it.amount);
      return { description: text(it.name, 200) || "Item", quantity: qty, unit_cents: unit, amount_cents: unit * qty };
    });
    const kind = fromSchedule.has(hlId) ? "retainer" : "custom";
    const state = invoiceStateFrom(hl);
    const { error } = await db.from("invoices").insert({
      hl_invoice_id: hlId,
      source: "highlevel",
      kind,
      customer_email: String(customer.email).toLowerCase(),
      customer_name: (customer.name as string | null) ?? contact?.name ?? null,
      customer_company: (customer.company as string | null) ?? null,
      line_items: items,
      currency: "usd",
      subtotal_cents: items.reduce((s, i) => s + i.amount_cents, 0),
      total_cents: cents(hl.total),
      notes: typeof hl.termsNotes === "string" ? hl.termsNotes.slice(0, 4000) : null,
      due_date: typeof hl.dueDate === "string" ? hl.dueDate.slice(0, 10) : null,
      status: state.status === "void" ? "void" : "open",
      sent_at: ["sent", "viewed", "paid", "partially_paid", "overdue"].includes(String(hl.status)) ? String(hl.createdAt ?? new Date().toISOString()) : null,
      hl_sent_at: ["sent", "viewed", "paid", "partially_paid", "overdue"].includes(String(hl.status)) ? String(hl.createdAt ?? new Date().toISOString()) : null,
      created_by: "highlevel",
      project_ids: [],
      ...state,
    });
    if (error) {
      out.skipped.push(`${hlId}: ${error.message}`);
      continue;
    }
    out.imported += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* a premade sale -> a paid invoice on the contact                     */
/* ------------------------------------------------------------------ */

type Card = { brand: string; last4: string } | null;

/** The order's lines as HighLevel items: the product, then each bump it carried. Pure. */
export function saleItems(order: Row, productName: string): { name: string; currency: string; amount: number; qty: number }[] {
  const meta = (order.metadata as Row | null) ?? {};
  const total = Number(order.amount_cents ?? 0);
  const bumps = Array.isArray(meta.bumps) ? (meta.bumps as Row[]) : [];
  const bumpLines = bumps
    .map((b) => ({ name: text(b.name ?? b.title ?? b.sku, 150), amountCents: Number(b.price_cents ?? b.amount_cents ?? 0) }))
    .filter((b) => b.name && b.amountCents > 0);
  const bumpTotal = bumpLines.reduce((s, b) => s + b.amountCents, 0);
  const base = Number(meta.base_cents ?? total - bumpTotal);
  if (bumpLines.length && base > 0 && base + bumpTotal === total) {
    return [
      { name: text(productName, 150), currency: "USD", amount: dollars(base), qty: 1 },
      ...bumpLines.map((b) => ({ name: b.name, currency: "USD", amount: dollars(b.amountCents), qty: 1 })),
    ];
  }
  /* an order rebuilt from its payment carries the customization as one
     number, never itemised: show it as one line rather than fold it in */
  const bumpCents = Number(meta.bump_cents ?? 0);
  if (!bumpLines.length && bumpCents > 0 && bumpCents < total) {
    return [
      { name: text(productName, 150), currency: "USD", amount: dollars(total - bumpCents), qty: 1 },
      { name: "Customization", currency: "USD", amount: dollars(bumpCents), qty: 1 },
    ];
  }
  return [{ name: text(productName, 150), currency: "USD", amount: dollars(total), qty: 1 }];
}

/** The charge behind a payment intent, or null when Stripe cannot say. Fail-soft. */
async function latestCharge(paymentIntentId: unknown): Promise<Stripe.Charge | null> {
  if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_") || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge;
    return charge && typeof charge === "object" ? (charge as Stripe.Charge) : null;
  } catch {
    return null;
  }
}

async function cardOf(paymentIntentId: unknown): Promise<Card> {
  const card = (await latestCharge(paymentIntentId))?.payment_method_details?.card;
  return card ? { brand: String(card.brand ?? "card"), last4: String(card.last4 ?? "") } : null;
}

/** The line on the contact for money that went back. Pure. */
export function refundNote(r: { amountCents: number; on: string; reference: string | null }): string {
  return `Refunded ${moneyText(r.amountCents)} on ${r.on.slice(0, 10)}${r.reference ? `, Stripe ${r.reference}` : ""}.`;
}

/*
 * A refund has no call in HighLevel's invoice API, so the ledger over there
 * is corrected the way a bookkeeper would: the invoice is voided if it was
 * never paid there, and the contact carries a note saying what went back
 * and when, once. Before this the paid invoice recorded there stayed paid
 * for good (audit, 15 September 2026). The mark lives in the order's
 * metadata, so a retry never writes a second note.
 */
async function mirrorRefund(
  db: Db,
  cfg: HlConfig,
  order: Row,
  deps: { contactIdFor: (customer: Row) => Promise<string>; allowed: (email: string) => boolean },
): Promise<Outcome> {
  const orderId = String(order.id);
  const hlId = typeof order.hl_invoice_id === "string" && order.hl_invoice_id ? order.hl_invoice_id : null;
  if (!hlId) return { status: "skipped", note: "refunded before the sale was recorded in HighLevel; nothing to undo there" };
  const meta = (order.metadata as Row | null) ?? {};
  if (meta.hl_refund_noted_at) return { status: "unchanged", note: `refund already noted on invoice ${hlId}` };
  const email = String(order.customer_email ?? "").toLowerCase();
  if (!deps.allowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };
  const { data: customer } = await db.from("customers").select("*").ilike("email", likeLiteral(email)).maybeSingle();
  if (!customer) return { status: "skipped", note: `no customer row for ${email}` };

  const notes: string[] = [];
  const hl = await fetchInvoice(cfg, hlId);
  const hlStatus = String(hl?.status ?? "");
  let gone = !hl;
  if (!hl) notes.push("the invoice is gone in HighLevel");
  else if (hlStatus === "paid" || hlStatus === "partially_paid") notes.push("paid there, so it stays paid: HighLevel has no refund call");
  else if (hlStatus === "void" || hlStatus === "voided") {
    notes.push("already void there");
    gone = true;
  } else {
    await hlFetch(`/invoices/${hlId}/void`, { method: "POST", body: JSON.stringify(alt(cfg)) });
    notes.push("voided in HighLevel");
    gone = true;
  }

  /* what went back and when: Stripe's charge first, else the refund event, else the order */
  const { data: events } = await db
    .from("order_events")
    .select("payload, created_at")
    .eq("order_id", orderId)
    .in("event_type", ["refunded", "dispute_lost"])
    .order("created_at", { ascending: false })
    .limit(1);
  const event = ((events ?? []) as Row[])[0] ?? null;
  const eventCents = Number(((event?.payload as Row | null) ?? {}).amount_cents ?? 0);
  const charge = await latestCharge(order.stripe_payment_intent_id);
  const amountCents = charge?.amount_refunded || eventCents || Number(order.amount_cents ?? 0);
  const on = typeof event?.created_at === "string" ? event.created_at : new Date().toISOString();
  const pi = typeof order.stripe_payment_intent_id === "string" ? order.stripe_payment_intent_id : null;
  const line = refundNote({ amountCents, on, reference: charge?.id ?? pi });
  const contactId = await deps.contactIdFor(customer);
  await hlFetch(`/contacts/${contactId}/notes`, { method: "POST", body: JSON.stringify({ body: `${line} Invoice ${hlId}.` }) });
  await db.from("orders").update({ metadata: { ...meta, hl_refund_noted_at: new Date().toISOString() } }).eq("id", orderId);
  /* HighLevel stops answering for a voided invoice; a link kept would read as drift every night */
  if (gone) await dropLink(db, "order", orderId, "invoice");
  return { status: "done", note: ["refund noted on the contact", ...notes].join("; ") };
}

/**
 * Record one paid order in HighLevel as an invoice that is already paid,
 * with the Stripe reference in the notes. The order stays the record of
 * the sale on our side; the invoice is what the studio sees in HighLevel's
 * ledger. Nothing is charged: the money moved on the site.
 */
export async function syncOrderSale(
  db: Db,
  cfg: HlConfig,
  orderId: string,
  deps: { contactIdFor: (customer: Row) => Promise<string>; allowed: (email: string) => boolean },
): Promise<Outcome> {
  const { data: order } = await db
    .from("orders")
    .select("*, product:products(name, sku, metadata)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { status: "skipped", note: "order row is gone" };
  if (order.status === "refunded") return await mirrorRefund(db, cfg, order, deps);
  if (order.status !== "paid") return { status: "skipped", note: `order is ${String(order.status)}, not paid` };
  const product = (order.product as { name?: string; sku?: string; metadata?: Row } | null) ?? null;
  if (order.hl_invoice_id) {
    /* made on an earlier pass: finish recording the payment if that part
       failed, and never make a second invoice (audit, 15 September 2026) */
    const existing = await hlFetch(`/invoices/${String(order.hl_invoice_id)}?${q(cfg)}`, { method: "GET" }).catch(() => null);
    if (existing && String(existing.status ?? "") === "paid")
      return { status: "unchanged", note: `invoice ${String(order.hl_invoice_id)}` };
    await recordSalePayment(cfg, String(order.hl_invoice_id), order);
    return { status: "done", note: `payment recorded on invoice ${String(order.hl_invoice_id)}` };
  }
  if (product?.metadata?.invoice) return { status: "skipped", note: "a legacy invoice payment; the invoice itself is what moves" };
  if (Number(order.amount_cents ?? 0) <= 0) return { status: "skipped", note: "nothing was charged" };
  const email = String(order.customer_email ?? "").toLowerCase();
  if (!deps.allowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };
  const { data: customer } = await db.from("customers").select("*").ilike("email", likeLiteral(email)).maybeSingle();
  if (!customer) return { status: "skipped", note: `no customer row for ${email}` };

  const contactId = await deps.contactIdFor(customer);
  const contact = contactOf(customer, contactId);
  const name = product?.name ?? String((order.metadata as Row | null)?.sku ?? "Order");
  const number = String(order.invoice_number ?? `GV-${orderId.slice(0, 8).toUpperCase()}`);
  const paidOn = day(order.paid_at);
  const made = await hlFetch("/invoices/", {
    method: "POST",
    body: JSON.stringify({
      ...alt(cfg),
      name: `${number}: ${text(name, 80)}`,
      title: "INVOICE",
      currency: "USD",
      businessDetails: BUSINESS,
      contactDetails: contact,
      items: saleItems(order, name),
      discount: { type: "percentage", value: 0 },
      issueDate: paidOn,
      /* the money is already in; HighLevel still refuses a due date behind us */
      dueDate: dueDay(paidOn),
      sentTo: { email: [contact.email] },
      liveMode: liveMode(),
    }),
  });
  const hlId = String(made._id ?? made.id);
  /* our side first: a failure past this line retries into the branch above
     instead of making another invoice */
  await db.from("orders").update({ hl_invoice_id: hlId }).eq("id", orderId);
  await putLink(db, cfg, { kind: "order", entity_id: orderId, hl_kind: "invoice", hl_id: hlId, fingerprint: hlId });
  const card = await recordSalePayment(cfg, hlId, order);
  return { status: "done", note: `paid invoice ${hlId} recorded (${card ? `${card.brand} ${card.last4}` : "card on file"})` };
}

/** The payment that already happened on the site, recorded on its HighLevel invoice. */
async function recordSalePayment(cfg: HlConfig, hlId: string, order: Row): Promise<Card> {
  const card = await cardOf(order.stripe_payment_intent_id);
  const pi = typeof order.stripe_payment_intent_id === "string" ? order.stripe_payment_intent_id : "";
  await hlFetch(`/invoices/${hlId}/record-payment`, {
    method: "POST",
    body: JSON.stringify({
      ...alt(cfg),
      mode: card ? "card" : "other",
      ...(card ? { card } : {}),
      notes: `Paid on ghlvideo.com${pi ? `, Stripe ${pi}` : ""}`,
      amount: dollars(Number(order.amount_cents)),
    }),
  });
  return card;
}

/* ------------------------------------------------------------------ */
/* the retainer's recurring invoice                                    */
/* ------------------------------------------------------------------ */

/** The first of next month, or the retainer's start if that is still ahead. */
export function nextBillingDay(retainer: Retainer, today = new Date()): string {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  return retainer.startedOn > today.toISOString().slice(0, 10) ? retainer.startedOn : first;
}

export function schedulePayload(retainer: Retainer, contact: Contact, cfg: HlConfig, today = new Date()) {
  const startDate = nextBillingDay(retainer, today);
  return {
    ...alt(cfg),
    name: retainer.name,
    title: "INVOICE",
    currency: "USD",
    businessDetails: BUSINESS,
    contactDetails: contact,
    items: [
      {
        name: `${retainer.name}, monthly: ${retainer.videosMin} to ${retainer.videosMax} videos`,
        currency: "USD",
        amount: dollars(retainer.monthlyCents),
        qty: 1,
      },
    ],
    discount: { type: "percentage", value: 0 },
    schedule: { rrule: { intervalType: "monthly", interval: 1, startDate, dayOfMonth: 1, endType: "never" } },
    sentTo: { email: [contact.email] },
    liveMode: liveMode(),
  };
}

/**
 * Keep the partnership's monthly bill scheduled in HighLevel: made and
 * started when the terms appear, updated when they change, cancelled when
 * they go. Runs inside the customer sync, after the contact is there.
 */
/** A schedule link that exists in HighLevel but was not yet started carries this mark. */
const UNSTARTED = "unstarted:";

export async function syncRetainerSchedule(
  db: Db,
  cfg: HlConfig,
  customer: Row,
  contactId: string,
  fingerprint: (v: unknown) => string,
): Promise<string | null> {
  const id = String(customer.id);
  const retainer = parseRetainer(customer.retainer);
  const link = await getLink(db, cfg, "customer", id, "schedule");
  if (!retainer) {
    if (!link) return null;
    try {
      await hlFetch(`/invoices/schedule/${link.hl_id}/cancel`, { method: "POST", body: JSON.stringify(alt(cfg)) });
    } catch (e) {
      if (!(e instanceof HighLevelError) || e.status >= 500) throw e;
    }
    await dropLink(db, "customer", id, "schedule");
    await db.from("customers").update({ hl_retainer_schedule_id: null }).eq("id", id);
    return "retainer schedule cancelled";
  }
  const payload = schedulePayload(retainer, contactOf(customer, contactId), cfg);
  /* the start date moves every month; what matters is the terms */
  const fp = fingerprint({ ...payload, schedule: undefined });
  if (link && link.fingerprint === fp) return null;
  const start = (sid: string) =>
    hlFetch(`/invoices/schedule/${sid}/schedule`, {
      method: "POST",
      body: JSON.stringify({ ...alt(cfg), liveMode: liveMode(), autoPayment: { enable: false } }),
    });
  if (!link) {
    const made = await hlFetch("/invoices/schedule", { method: "POST", body: JSON.stringify(payload) });
    const sid = String(made._id ?? made.id);
    /* the link first, marked not yet started, so a failure to start retries
       the start and never makes a second schedule */
    await putLink(db, cfg, { kind: "customer", entity_id: id, hl_kind: "schedule", hl_id: sid, fingerprint: `${UNSTARTED}${fp}` });
    await db.from("customers").update({ hl_retainer_schedule_id: sid }).eq("id", id);
    await start(sid);
    await putLink(db, cfg, { kind: "customer", entity_id: id, hl_kind: "schedule", hl_id: sid, fingerprint: fp });
    return `retainer schedule ${sid} started, first bill ${payload.schedule.rrule.startDate}`;
  }
  if (link.fingerprint === `${UNSTARTED}${fp}`) {
    try {
      await start(link.hl_id);
    } catch (e) {
      /* already running from the earlier attempt that did not get to say so */
      if (!(e instanceof HighLevelError) || e.status >= 500) throw e;
    }
    await putLink(db, cfg, { kind: "customer", entity_id: id, hl_kind: "schedule", hl_id: link.hl_id, fingerprint: fp });
    return `retainer schedule ${link.hl_id} started`;
  }
  await hlFetch(`/invoices/schedule/${link.hl_id}`, { method: "PUT", body: JSON.stringify(payload) });
  await putLink(db, cfg, { kind: "customer", entity_id: id, hl_kind: "schedule", hl_id: link.hl_id, fingerprint: fp });
  return `retainer schedule ${link.hl_id} updated`;
}

/* ------------------------------------------------------------------ */
/* the catalogue as HighLevel products                                 */
/* ------------------------------------------------------------------ */

export type ProductSyncResult = { seen: number; made: number; repriced: number; unchanged: number; errors: string[] };

/**
 * Mirror every sellable one-time product into HighLevel with a one-time
 * price, so an invoice or an order form there can pick from the catalogue.
 * Ids are kept in products.metadata; a second run changes nothing.
 */
export async function syncProductsToHighLevel(db: Db, cfg: HlConfig): Promise<ProductSyncResult> {
  const out: ProductSyncResult = { seen: 0, made: 0, repriced: 0, unchanged: 0, errors: [] };
  const { data } = await db.from("products").select("id, sku, name, description, price_cents, type, active, metadata").eq("type", "one_time").eq("active", true);
  const loc = encodeURIComponent(cfg.locationId);
  for (const p of (data ?? []) as Row[]) {
    const meta = (p.metadata as Row | null) ?? {};
    if (meta.invoice || meta.demo) continue;
    out.seen += 1;
    try {
      let productId = typeof meta.hl_product_id === "string" ? meta.hl_product_id : null;
      let priceId = typeof meta.hl_price_id === "string" ? meta.hl_price_id : null;
      if (productId) {
        try {
          await hlFetch(`/products/${productId}?locationId=${loc}`, { method: "GET" });
        } catch (e) {
          if (e instanceof HighLevelError && e.status === 404) {
            productId = null;
            priceId = null;
          } else throw e;
        }
      }
      let changed = false;
      if (!productId) {
        const made = await hlFetch("/products/", {
          method: "POST",
          body: JSON.stringify({
            locationId: cfg.locationId,
            name: text(p.name, 150),
            description: text(p.description, 1000),
            productType: "SERVICE",
            availableInStore: false,
          }),
        });
        productId = String(made._id ?? made.id);
        out.made += 1;
        changed = true;
      }
      const amount = dollars(Number(p.price_cents ?? 0));
      if (!priceId) {
        const price = await hlFetch(`/products/${productId}/price`, {
          method: "POST",
          body: JSON.stringify({ locationId: cfg.locationId, name: "One-time", type: "one_time", currency: "USD", amount }),
        });
        priceId = String(price._id ?? price.id);
        changed = true;
      } else if (Number(meta.hl_price_cents) !== Number(p.price_cents)) {
        await hlFetch(`/products/${productId}/price/${priceId}`, {
          method: "PUT",
          body: JSON.stringify({ locationId: cfg.locationId, name: "One-time", type: "one_time", currency: "USD", amount }),
        });
        out.repriced += 1;
        changed = true;
      }
      if (changed) {
        await db
          .from("products")
          .update({ metadata: { ...meta, hl_product_id: productId, hl_price_id: priceId, hl_price_cents: Number(p.price_cents ?? 0) } })
          .eq("id", String(p.id));
      } else out.unchanged += 1;
    } catch (e) {
      out.errors.push(`${String(p.sku)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* inbound: an invoice event from a HighLevel workflow                 */
/* ------------------------------------------------------------------ */

/** The invoice id inside a workflow webhook payload, whatever shape it took. Pure. */
export function inboundInvoiceId(payload: Row): string | null {
  const direct = payload.invoiceId ?? payload.invoice_id;
  if (typeof direct === "string" && direct) return direct;
  const nested = payload.invoice as Row | undefined;
  const nestedId = nested?._id ?? nested?.id;
  if (typeof nestedId === "string" && nestedId) return nestedId;
  if (payload.invoiceNumber !== undefined || payload.amountDue !== undefined) {
    const own = payload._id ?? payload.id;
    if (typeof own === "string" && own) return own;
  }
  return null;
}

/** Read one invoice back from HighLevel and apply it: our mirror row, or a new one. */
export async function applyInboundInvoice(db: Db, cfg: HlConfig, hlId: string): Promise<string> {
  const hl = await fetchInvoice(cfg, hlId);
  if (!hl) return `invoice ${hlId} is not in HighLevel`;
  const { data: mine } = await db.from("invoices").select("id, paid_at").eq("hl_invoice_id", hlId).maybeSingle();
  if (mine) {
    const patch = await applyInvoiceState(db, String(mine.id), hl);
    if (patch.paid_at && !mine.paid_at) await notifyInvoicePaid(db, String(mine.id));
    return `invoice ${hlId}: ${String(patch.hl_status)}${patch.paid_at ? ", paid" : ""}`;
  }
  const { data: order } = await db.from("orders").select("id").eq("hl_invoice_id", hlId).maybeSingle();
  if (order) return `invoice ${hlId} records order ${String(order.id)}; nothing to change`;
  const pulled = await pullInvoices(db, cfg, { pages: 1 });
  return pulled.imported ? `invoice ${hlId} imported` : `invoice ${hlId}: ${pulled.skipped.join("; ") || "not imported"}`;
}
