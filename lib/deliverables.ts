/*
 * Order deliverables: turning "they bought the AI First SaaS Pack" into nine
 * named rows the studio can actually work through.
 *
 * An order points at exactly one product. That product is one of three shapes
 * (see the catalog, phase 2), and each expands differently:
 *
 *   video   one row, the video itself
 *   pack    one row per member in catalog_pack_items, in the advertised
 *           sections. Feature animation packs have no itemised members, they
 *           are sold as a set of N, so they expand to N numbered slots
 *   bundle  one EMPTY row per slot the offer promises, from
 *           catalog_bundle_rules. The customer names them at intake, which is
 *           what fillBundlePicks does
 *
 * Order bumps never add rows. Every live bump is a customization add-on priced
 * against the videos already in the order, not an extra video.
 *
 * Everything here is idempotent. A double webhook, a retried backfill or a
 * resubmitted intake must never give a customer a duplicated video list; the
 * unique index on (order_id, position) is the backstop under that promise.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { bundlePickPools, PICK_LABEL, type BundlePickKey, type BundleSelections } from "@/lib/bundles";
import { skuFor } from "@/lib/content/codes";
import type { DeliverableStatus } from "@/lib/deliverable-status";

type DB = SupabaseClient;

/* The status vocabulary lives in its own import-free file so the browser
 * bundles can use it without dragging the catalog along. Re-exported here so
 * server code has one place to import from. */
export {
  DELIVERABLE_STATUSES,
  STATUS_LABEL,
  isWatchable,
  type DeliverableStatus,
} from "@/lib/deliverable-status";

export type Deliverable = {
  id: string;
  order_id: string;
  catalog_code: string | null;
  title: string;
  category: string | null;
  group_label: string | null;
  position: number;
  status: DeliverableStatus;
  revision_round: number;
  video_url: string | null;
  thumbnail_url: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  approved_at: string | null;
  /* when this video is promised; null until the client's brief lands */
  due_at: string | null;
};

/** One planned row, before it exists in the database. */
export type DeliverablePlan = {
  catalog_code: string | null;
  title: string;
  category: string | null;
  group_label: string | null;
  position: number;
};

/**
 * What videos does this sku owe? Reads the catalog, so it stays correct as
 * soon as a pack's contents are edited in admin.
 */
export async function planDeliverables(db: DB, sku: string): Promise<DeliverablePlan[]> {
  const { data: row } = await db
    .from("catalog")
    .select("code, title, category, kind, pack_count")
    .eq("code", sku)
    .maybeSingle();

  // Not in the catalog: a custom video, a quote-to-order, or a legacy sku.
  // Those are a single deliverable named after the product.
  if (!row) {
    const { data: product } = await db
      .from("products")
      .select("name")
      .eq("sku", sku)
      .maybeSingle();
    if (!product) return [];

    /*
     * An add-on owes no video.
     *
     * Extra work invoiced against an order we already delivered, a niche
     * customisation, a re-cut, a language pass, changes videos that exist
     * rather than creating one. Expanding it made a phantom row that sat in
     * the client's list as a video queued forever and showed on the studio
     * board as work nobody could finish. The invoice naming a parent order is
     * exactly what says "this is extra work on that", so it is what we check.
     */
    const { data: invoice } = await db
      .from("invoices")
      .select("parent_order_id")
      .eq("product_sku", sku)
      .maybeSingle();
    if (invoice?.parent_order_id) return [];

    return [
      { catalog_code: null, title: product.name as string, category: null, group_label: null, position: 0 },
    ];
  }

  if (row.kind === "video") {
    return [
      {
        catalog_code: row.code as string,
        title: row.title as string,
        category: (row.category as string | null) ?? null,
        group_label: null,
        position: 0,
      },
    ];
  }

  if (row.kind === "pack") {
    const { data: items } = await db
      .from("catalog_pack_items")
      .select("item_code, group_label, sort")
      .eq("pack_code", sku)
      .order("sort");

    if (items && items.length) {
      const codes = items.map((i) => i.item_code as string);
      const { data: videos } = await db
        .from("catalog")
        .select("code, title, category")
        .in("code", codes);
      const byCode = new Map((videos ?? []).map((v) => [v.code as string, v]));
      return items.map((i, idx) => {
        const v = byCode.get(i.item_code as string);
        return {
          catalog_code: i.item_code as string,
          // a member missing from the catalog would be a composition bug, but
          // the customer's row should still read as something, not as blank
          title: (v?.title as string | undefined) ?? (i.item_code as string),
          category: (v?.category as string | null | undefined) ?? null,
          group_label: (i.group_label as string | null) ?? null,
          position: idx,
        };
      });
    }

    // Sold as a set of N with no itemised contents: the feature animation packs.
    const n = (row.pack_count as number | null) ?? 0;
    return Array.from({ length: n }, (_, i) => ({
      catalog_code: null,
      title: `Feature animation ${i + 1}`,
      category: "Feature Animation",
      group_label: row.title as string,
      position: i,
    }));
  }

  // bundle: empty slots the customer fills at intake
  const { data: rules } = await db
    .from("catalog_bundle_rules")
    .select("label, category, count, sort")
    .eq("bundle_code", sku)
    .order("sort");

  const plans: DeliverablePlan[] = [];
  for (const r of rules ?? []) {
    for (let i = 0; i < (r.count as number); i++) {
      plans.push({
        catalog_code: null,
        title: (r.category as string | null) ?? (r.label as string),
        category: (r.category as string | null) ?? null,
        group_label: r.label as string,
        position: plans.length,
      });
    }
  }
  return plans;
}

/**
 * Create the deliverable rows for a paid order. Safe to call more than once:
 * an order that already has rows is left exactly as it is, so a replayed
 * webhook can never wipe the studio's progress.
 */
export async function createDeliverablesForOrder(
  db: DB,
  orderId: string,
): Promise<{ created: number; reason?: string }> {
  const { data: existing } = await db
    .from("order_deliverables")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existing && existing.length) return { created: 0, reason: "already has deliverables" };

  const { data: order } = await db
    .from("orders")
    .select("id, product_id, products(sku)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { created: 0, reason: "order not found" };

  const sku = (order.products as { sku?: string } | null)?.sku;
  if (!sku) return { created: 0, reason: "order has no product sku" };

  const plans = await planDeliverables(db, sku);
  if (!plans.length) return { created: 0, reason: `nothing to expand for ${sku}` };

  const { error } = await db
    .from("order_deliverables")
    .insert(plans.map((p) => ({ ...p, order_id: orderId })));
  // A concurrent caller winning the same insert trips the (order_id, position)
  // unique index. That is the guard doing its job, not a failure to report.
  if (error) {
    if (error.code === "23505") return { created: 0, reason: "created by a concurrent call" };
    throw new Error(`deliverables insert failed: ${error.message}`);
  }
  return { created: plans.length };
}

/**
 * Stamp the promised date on every video of an order.
 *
 * Called when the brief lands, because that is when the clock starts and not
 * before. Safe to call again: it recomputes from the order's own intake date,
 * so a resubmitted brief does not quietly move the deadline, and a video the
 * studio has already finished is left alone.
 *
 * Returns how many it dated, or a reason it could not, so the caller can log
 * rather than guess.
 */
export async function setDueDatesForOrder(
  db: DB,
  orderId: string,
): Promise<{ dated: number; reason?: string }> {
  const { data: order } = await db
    .from("orders")
    .select("id, intake_completed_at, products(metadata)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { dated: 0, reason: "order not found" };

  const briefAt = order.intake_completed_at as string | null;
  /* No brief, no promise. A date invented from the payment would be a
   * commitment we never made and might have no way of keeping. */
  if (!briefAt) return { dated: 0, reason: "no brief yet" };

  const { turnaroundDays, dueAtFrom } = await import("@/lib/delivery-dates");
  const meta = (order.products as { metadata?: unknown } | null)?.metadata;
  const due = dueAtFrom(briefAt, turnaroundDays(meta));

  /* Finished work keeps whatever it was promised: rewriting the date on a
   * delivered video would erase the evidence of whether we were on time. */
  const { data, error } = await db
    .from("order_deliverables")
    .update({ due_at: due })
    .eq("order_id", orderId)
    .not("status", "in", "(approved,delivered)")
    .select("id");

  if (error) throw new Error(`due date update failed: ${error.message}`);
  return { dated: (data ?? []).length };
}

/**
 * Name the empty slots on a bundle order from what the customer picked at
 * intake. Only ever fills blanks: a slot that already has a video keeps it, so
 * editing the brief later cannot silently reassign work in progress.
 */
export async function fillBundlePicks(
  db: DB,
  orderId: string,
  selections: BundleSelections | null | undefined,
): Promise<{ filled: number }> {
  if (!selections) return { filled: 0 };

  const { data: slots } = await db
    .from("order_deliverables")
    .select("id, category, position")
    .eq("order_id", orderId)
    .is("catalog_code", null)
    .order("position");
  if (!slots || !slots.length) return { filled: 0 };

  // slug -> the title the catalog knows it by, from the same pools the picker
  // offered, so a pick can always be named even if its code map entry is stale
  const pools = bundlePickPools();
  const titleBySlug = new Map<string, string>();
  for (const key of Object.keys(pools) as BundlePickKey[]) {
    for (const v of pools[key]) titleBySlug.set(v.slug, v.title);
  }

  const { data: catalog } = await db.from("catalog").select("code, title, category");
  const byTitle = new Map(
    (catalog ?? []).map((c) => [(c.title as string).trim().toLowerCase(), c]),
  );

  // queue of picks per category, in the order the customer chose them
  const queue = new Map<string, { code: string | null; title: string; category: string | null }[]>();
  for (const key of Object.keys(selections) as BundlePickKey[]) {
    const label = PICK_LABEL[key];
    const list = queue.get(label) ?? [];
    for (const slug of selections[key] ?? []) {
      const title = titleBySlug.get(slug) ?? slug;
      const hit = byTitle.get(title.trim().toLowerCase());
      list.push({
        code: (hit?.code as string | undefined) ?? skuFor(slug) ?? null,
        title: (hit?.title as string | undefined) ?? title,
        category: (hit?.category as string | null | undefined) ?? label,
      });
    }
    queue.set(label, list);
  }

  let filled = 0;
  for (const slot of slots) {
    const list = queue.get((slot.category as string | null) ?? "");
    const pick = list?.shift();
    if (!pick) continue;
    const { error } = await db
      .from("order_deliverables")
      .update({
        catalog_code: pick.code,
        title: pick.title,
        category: pick.category,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id);
    if (!error) filled++;
  }
  return { filled };
}

/** Every deliverable on an order, in display order. */
export async function listDeliverables(db: DB, orderId: string): Promise<Deliverable[]> {
  const { data } = await db
    .from("order_deliverables")
    .select("*")
    .eq("order_id", orderId)
    .order("position");
  return (data ?? []) as Deliverable[];
}
