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
 * Apply one inbound event: find the customer (by the link first, then by
 * email) and fill what changed. Returns what it did, for hl_inbound.
 */
export async function applyInbound(db: SupabaseClient, payload: Row, locationId: string | null): Promise<InboundResult> {
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
