/*
 * Money in HighLevel (phase 3). HighLevel raises the invoice, hosts the pay
 * page, takes the card through the studio's Stripe connection and keeps the
 * ledger. This module keeps our mirror in step with it, both ways:
 *
 *   invoice  -> HighLevel invoice   raised in admin, created and sent there,
 *                                  edited or voided there when we change it
 *   order    -> paid invoice        a premade sale paid on the site, recorded
 *                                  on the contact with its Stripe reference
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
const day = (v: unknown) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : new Date().toISOString().slice(0, 10));
/** HighLevel refuses a due date that has passed: a bill raised late is due today. */
export const dueDay = (v: unknown, today = new Date().toISOString().slice(0, 10)) => {
  const d = day(v);
  return d < today ? today : d;
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

  const { data: customer } = await db.from("customers").select("*").ilike("email", email).maybeSingle();
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
 * Read the state of every open mirrored invoice back from HighLevel: paid,
 * viewed, void. One GET per open invoice, so a client paying on HighLevel's
 * page shows paid here within the minute.
 */
export async function pollOpenInvoices(db: Db, cfg: HlConfig, limit = 50): Promise<{ checked: number; paid: number; changed: number }> {
  const { data } = await db
    .from("invoices")
    .select("id, hl_invoice_id, hl_status, amount_paid_cents")
    .not("hl_invoice_id", "is", null)
    .is("paid_at", null)
    .eq("status", "open")
    .order("updated_at", { ascending: true })
    .limit(limit);
  const out = { checked: 0, paid: 0, changed: 0 };
  for (const r of (data ?? []) as Row[]) {
    const hl = await fetchInvoice(cfg, String(r.hl_invoice_id));
    out.checked += 1;
    if (!hl) continue;
    const status = String(hl.status ?? "");
    if (status !== String(r.hl_status ?? "") || cents(hl.amountPaid) !== Number(r.amount_paid_cents ?? 0)) {
      await applyInvoiceState(db, String(r.id), hl);
      out.changed += 1;
      if (status === "paid") out.paid += 1;
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
export async function pullInvoices(db: Db, cfg: HlConfig, opts: { pages?: number } = {}): Promise<{ seen: number; imported: number; skipped: string[] }> {
  const out = { seen: 0, imported: 0, skipped: [] as string[] };
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

  const ids = listed.map((i) => String(i._id ?? i.id));
  const { data: have } = await db.from("invoices").select("hl_invoice_id").in("hl_invoice_id", ids);
  const known = new Set(((have ?? []) as Row[]).map((r) => String(r.hl_invoice_id)));
  const { data: linkedOrders } = await db.from("orders").select("hl_invoice_id").in("hl_invoice_id", ids);
  for (const o of (linkedOrders ?? []) as Row[]) known.add(String(o.hl_invoice_id));
  const missing = listed.filter((i) => !known.has(String(i._id ?? i.id)));
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
      const { data } = await db.from("customers").select("*").ilike("email", email).maybeSingle();
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
  return [{ name: text(productName, 150), currency: "USD", amount: dollars(total), qty: 1 }];
}

async function cardOf(paymentIntentId: unknown): Promise<Card> {
  if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_") || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const card = charge?.payment_method_details?.card;
    return card ? { brand: String(card.brand ?? "card"), last4: String(card.last4 ?? "") } : null;
  } catch {
    return null;
  }
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
  if (order.status !== "paid") return { status: "skipped", note: `order is ${String(order.status)}, not paid` };
  if (order.hl_invoice_id) return { status: "unchanged", note: `invoice ${String(order.hl_invoice_id)}` };
  const product = (order.product as { name?: string; sku?: string; metadata?: Row } | null) ?? null;
  if (product?.metadata?.invoice) return { status: "skipped", note: "a legacy invoice payment; the invoice itself is what moves" };
  if (Number(order.amount_cents ?? 0) <= 0) return { status: "skipped", note: "nothing was charged" };
  const email = String(order.customer_email ?? "").toLowerCase();
  if (!deps.allowed(email)) return { status: "skipped", note: `${email} is outside HIGHLEVEL_SYNC_ALLOW` };
  const { data: customer } = await db.from("customers").select("*").ilike("email", email).maybeSingle();
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
  await db.from("orders").update({ hl_invoice_id: hlId }).eq("id", orderId);
  await putLink(db, cfg, { kind: "order", entity_id: orderId, hl_kind: "invoice", hl_id: hlId, fingerprint: hlId });
  return { status: "done", note: `paid invoice ${hlId} recorded (${card ? `${card.brand} ${card.last4}` : "card on file"})` };
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
  if (!link) {
    const made = await hlFetch("/invoices/schedule", { method: "POST", body: JSON.stringify(payload) });
    const sid = String(made._id ?? made.id);
    await hlFetch(`/invoices/schedule/${sid}/schedule`, {
      method: "POST",
      body: JSON.stringify({ ...alt(cfg), liveMode: liveMode(), autoPayment: { enable: false } }),
    });
    await putLink(db, cfg, { kind: "customer", entity_id: id, hl_kind: "schedule", hl_id: sid, fingerprint: fp });
    await db.from("customers").update({ hl_retainer_schedule_id: sid }).eq("id", id);
    return `retainer schedule ${sid} started, first bill ${payload.schedule.rrule.startDate}`;
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
  const { data: mine } = await db.from("invoices").select("id").eq("hl_invoice_id", hlId).maybeSingle();
  if (mine) {
    const patch = await applyInvoiceState(db, String(mine.id), hl);
    return `invoice ${hlId}: ${String(patch.hl_status)}${patch.paid_at ? ", paid" : ""}`;
  }
  const { data: order } = await db.from("orders").select("id").eq("hl_invoice_id", hlId).maybeSingle();
  if (order) return `invoice ${hlId} records order ${String(order.id)}; nothing to change`;
  const pulled = await pullInvoices(db, cfg, { pages: 1 });
  return pulled.imported ? `invoice ${hlId} imported` : `invoice ${hlId}: ${pulled.skipped.join("; ") || "not imported"}`;
}
