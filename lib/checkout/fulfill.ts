import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveProductBySku } from "./products";
import { syncOrderToHighLevel } from "./highlevel";

/*
 * Sync one paid order to HighLevel and record the outcome. Shared by the
 * Stripe webhook (which throws on failure to make Stripe retry) and the
 * admin "re-sync" action (which shows the result). Returns a result rather
 * than throwing, so each caller decides how to react. Idempotent: callers
 * gate on the opportunity not yet existing.
 */
type OrderRow = {
  id: string;
  customer_id: string;
  customer_email: string;
  amount_cents: number;
  metadata: Record<string, unknown> | null;
};

export type SyncResult =
  | { ok: true; contactId: string; opportunityId: string }
  | { ok: false; error: string };

export async function syncPaidOrderToHighLevel(
  db: SupabaseClient,
  order: OrderRow,
): Promise<SyncResult> {
  const meta = order.metadata ?? {};
  try {
    const product = await getActiveProductBySku((meta.sku as string) ?? "");
    const tags = (product?.metadata?.hl_tags as string[]) ?? ["ghlv-purchase"];
    const { data: customer } = await db
      .from("customers")
      .select("name, phone, company")
      .eq("id", order.customer_id)
      .maybeSingle();

    const { contactId, opportunityId } = await syncOrderToHighLevel({
      email: order.customer_email,
      name: customer?.name ?? undefined,
      phone: customer?.phone ?? undefined,
      company: customer?.company ?? undefined,
      tags,
      opportunityName: `${product?.name ?? "Order"} - ${order.customer_email}`,
      amountDollars: Math.round(order.amount_cents) / 100,
    });

    await db
      .from("orders")
      .update({
        highlevel_contact_id: contactId,
        highlevel_opportunity_id: opportunityId,
        metadata: { ...meta, hl_sync_failed: false },
      })
      .eq("id", order.id);
    await db
      .from("customers")
      .update({ highlevel_contact_id: contactId })
      .eq("id", order.customer_id);
    await db.from("order_events").insert({
      order_id: order.id,
      event_type: "hl_synced",
      payload: { contactId, opportunityId, tags },
    });
    return { ok: true, contactId, opportunityId };
  } catch (err) {
    await db
      .from("orders")
      .update({ metadata: { ...meta, hl_sync_failed: true } })
      .eq("id", order.id);
    await db.from("order_events").insert({
      order_id: order.id,
      event_type: "hl_sync_failed",
      payload: { error: (err as Error).message },
    });
    return { ok: false, error: (err as Error).message };
  }
}
