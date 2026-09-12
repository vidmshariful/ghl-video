/*
 * Where our rows live in HighLevel, for the screens: the contact's page,
 * each project's deal card, and whether a change is still on its way. Read
 * from hl_links, which the sync writes, never from the legacy id column.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { contactUrl, opportunityUrl } from "./client";

type Row = Record<string, unknown>;

export type CustomerHighLevel = {
  contactId: string;
  contactUrl: string;
  syncedAt: string;
  /** changes to this customer not yet sent */
  pending: number;
};

export async function customerLinks(
  db: SupabaseClient,
  customerId: string,
  projectIds: string[],
): Promise<{ customer: CustomerHighLevel | null; dealUrls: Record<string, string> }> {
  const loc = process.env.HIGHLEVEL_LOCATION_ID;
  if (!loc) return { customer: null, dealUrls: {} };

  const { data: contact } = await db
    .from("hl_links")
    .select("hl_id, synced_at")
    .eq("location_id", loc)
    .eq("kind", "customer")
    .eq("hl_kind", "contact")
    .eq("entity_id", customerId)
    .maybeSingle();

  const dealUrls: Record<string, string> = {};
  if (projectIds.length) {
    const { data: deals } = await db
      .from("hl_links")
      .select("entity_id, hl_id")
      .eq("location_id", loc)
      .eq("kind", "project")
      .eq("hl_kind", "opportunity")
      .in("entity_id", projectIds);
    for (const d of (deals ?? []) as Row[]) dealUrls[String(d.entity_id)] = opportunityUrl(loc, String(d.hl_id));
  }

  if (!contact) return { customer: null, dealUrls };
  const { count } = await db
    .from("hl_sync_outbox")
    .select("id", { count: "exact", head: true })
    .is("done_at", null)
    .eq("kind", "customer")
    .eq("entity_id", customerId);
  return {
    customer: {
      contactId: String(contact.hl_id),
      contactUrl: contactUrl(loc, String(contact.hl_id)),
      syncedAt: String(contact.synced_at),
      pending: count ?? 0,
    },
    dealUrls,
  };
}
