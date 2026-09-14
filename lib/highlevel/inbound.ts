/*
 * The inbound half of the wire: what HighLevel tells us about a contact.
 *
 * A workflow in the sub-account posts to /api/webhooks/highlevel whenever a
 * contact changes. The payload is a workflow webhook's: flat, snake_case,
 * with the contact's id and its details. Every event is kept raw in
 * hl_inbound with how it was handled, so "why did this client's phone
 * change" always has an answer.
 *
 * Only the contact's own details come back across: name, phone, company.
 * What they have bought and what they are owed stays ours. Nothing is ever
 * blanked from here: an empty field in HighLevel is not an instruction to
 * forget what checkout collected.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { hlFetch } from "./client";

type Row = Record<string, unknown>;

export type InboundContact = {
  contactId: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
};

const str = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** The contact fields out of a workflow webhook payload, whatever casing it used. Pure. */
export function inboundContact(payload: Row): InboundContact {
  const first = str(payload.first_name) ?? str(payload.firstName);
  const last = str(payload.last_name) ?? str(payload.lastName);
  const name = str(payload.full_name) ?? str(payload.name) ?? [first, last].filter(Boolean).join(" ") ?? null;
  const rawTags = payload.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t).trim()).filter(Boolean)
    : typeof rawTags === "string"
      ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
  return {
    contactId: str(payload.contact_id, 80) ?? str(payload.contactId, 80) ?? str(payload.id, 80),
    email: (str(payload.email, 200) ?? "").toLowerCase() || null,
    name: name || null,
    phone: str(payload.phone, 40),
    company: str(payload.company_name, 160) ?? str(payload.companyName, 160),
    tags,
  };
}

export type InboundResult = { outcome: string; customerId: string | null; changed: string[] };

/**
 * Which side spoke last. A polled copy of a contact carries HighLevel's
 * dateUpdated; our row carries updated_at. When ours is the newer one, the
 * difference is a change of ours still on its way over, not an edit of
 * theirs, and applying it would undo what a person just typed here. Pure.
 */
export function theirsIsNewer(theirs: unknown, ours: unknown): boolean {
  const t = typeof theirs === "string" ? Date.parse(theirs) : NaN;
  const o = typeof ours === "string" ? Date.parse(ours) : NaN;
  if (!Number.isFinite(t)) return true;
  if (!Number.isFinite(o)) return true;
  return t >= o;
}

/**
 * Apply one inbound event: find the customer (by the link first, then by
 * email) and fill what changed. Returns what it did, for hl_inbound. A
 * webhook event is HighLevel speaking and always applies; a polled copy
 * says when it changed, and only applies when that is after our last edit.
 */
export async function applyInbound(
  db: SupabaseClient,
  payload: Row,
  locationId: string | null,
  opts: { changedAt?: unknown } = {},
): Promise<InboundResult> {
  const c = inboundContact(payload);
  let customer: Row | null = null;

  if (c.contactId) {
    const { data: link } = await db
      .from("hl_links")
      .select("entity_id, location_id")
      .eq("kind", "customer")
      .eq("hl_kind", "contact")
      .eq("hl_id", c.contactId)
      .maybeSingle();
    if (link && (!locationId || link.location_id === locationId)) {
      const { data } = await db.from("customers").select("*").eq("id", String(link.entity_id)).maybeSingle();
      customer = data ?? null;
    }
  }
  if (!customer && c.email) {
    const { data } = await db.from("customers").select("*").ilike("email", c.email).maybeSingle();
    customer = data ?? null;
  }
  if (!customer) return { outcome: "no matching customer", customerId: null, changed: [] };
  if (opts.changedAt !== undefined && !theirsIsNewer(opts.changedAt, customer.updated_at))
    return { outcome: "our copy is newer; nothing applied", customerId: String(customer.id), changed: [] };

  const patch: Row = {};
  if (c.name && c.name !== customer.name) patch.name = c.name;
  if (c.phone && c.phone !== customer.phone) patch.phone = c.phone;
  if (c.company && c.company !== customer.company) patch.company = c.company;
  const changed = Object.keys(patch);
  if (!changed.length) return { outcome: "nothing to change", customerId: String(customer.id), changed };

  patch.updated_at = new Date().toISOString();
  const { error } = await db.from("customers").update(patch).eq("id", String(customer.id));
  if (error) return { outcome: `update failed: ${error.message}`, customerId: String(customer.id), changed: [] };
  return { outcome: `updated ${changed.join(", ")}`, customerId: String(customer.id), changed };
}

/**
 * The same inbound, without a workflow: ask HighLevel which contacts
 * changed in the last little while and apply each one. The minute cron
 * asks with a five minute window, the nightly check with a day's, so a
 * skipped minute loses nothing. Our own writes bump a contact too; they
 * come back as "nothing to change" and cost one read. Only a change that
 * landed is recorded in hl_inbound, so the table stays a log of events and
 * not of polls. The webhook endpoint remains the faster door when a
 * workflow points at it.
 */
export async function pullContactChanges(
  db: SupabaseClient,
  locationId: string,
  windowMs: number,
): Promise<{ seen: number; changed: number; outcomes: string[] }> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const j = await hlFetch("/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      locationId,
      pageLimit: 100,
      filters: [{ field: "dateUpdated", operator: "range", value: { gte: since } }],
      sort: [{ field: "dateUpdated", direction: "desc" }],
    }),
  });
  const out = { seen: 0, changed: 0, outcomes: [] as string[] };
  for (const listed of (j.contacts as Row[]) ?? []) {
    out.seen += 1;
    /* the search only says which contacts moved: its copy lags and can still
       show one deleted a moment ago, so the truth is read by id */
    let c: Row;
    try {
      const fresh = await hlFetch(`/contacts/${String(listed.id)}`, { method: "GET" });
      c = (fresh.contact as Row) ?? fresh;
    } catch {
      continue;
    }
    const payload: Row = {
      type: "ContactChanged",
      contact_id: c.id,
      email: c.email,
      first_name: c.firstName,
      last_name: c.lastName,
      phone: c.phone,
      company_name: c.companyName,
      tags: c.tags,
      dateUpdated: c.dateUpdated,
    };
    const r = await applyInbound(db, payload, locationId, { changedAt: c.dateUpdated });
    if (!r.changed.length) continue;
    out.changed += 1;
    out.outcomes.push(`${String(c.email ?? c.id)}: ${r.outcome}`);
    await db.from("hl_inbound").insert({
      event: "contact.changed (polled)",
      payload,
      processed_at: new Date().toISOString(),
      outcome: r.outcome,
    });
  }
  return out;
}
