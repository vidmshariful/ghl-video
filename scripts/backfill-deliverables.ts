/*
 * Give every existing paid order its per-video rows.
 *
 * New orders get these at payment. This is for the ones already in the system,
 * so the studio board and the customer's My Videos list are not empty for
 * everybody who bought before today.
 *
 * Three things it is careful about:
 *  - it never touches an order that already has rows, so it is safe to re-run
 *  - it carries over the existing single delivery link ONLY when the order owes
 *    exactly one video, because that is the only case where which video the
 *    link belongs to is not a guess. The order level link is left in place
 *    either way, so nothing is lost
 *  - it seeds status from where the order already is, so a delivered order does
 *    not reappear on the board as if no work had been done
 *
 *   npm run backfill:deliverables -- --dry   preview
 *   npm run backfill:deliverables            write
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createDeliverablesForOrder, fillBundlePicks } from "@/lib/deliverables";
import type { BundleSelections } from "@/lib/bundles";

const DRY = process.argv.includes("--dry");

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* where the order already is -> where its videos start */
const STATUS_FROM_STAGE: Record<string, string> = {
  paid: "queued",
  intake: "queued",
  production: "in_production",
  review: "ready",
  delivered: "ready",
};

async function main() {
  const { data: orders } = await db
    .from("orders")
    .select("id, invoice_number, customer_email, fulfillment_stage, delivery_url, metadata, products(sku, name)")
    .eq("status", "paid")
    .order("created_at");

  const { data: existing } = await db.from("order_deliverables").select("order_id");
  const have = new Set((existing ?? []).map((d) => d.order_id as string));

  const todo = (orders ?? []).filter((o) => !have.has(o.id as string));
  console.log(`paid orders: ${(orders ?? []).length}, already expanded: ${have.size}, to do: ${todo.length}\n`);

  let rows = 0;
  for (const o of todo) {
    const sku = (o.products as { sku?: string; name?: string } | null)?.sku ?? "(none)";
    const stage = (o.fulfillment_stage as string) ?? "paid";

    if (DRY) {
      const { planDeliverables } = await import("@/lib/deliverables");
      const plans = await planDeliverables(db, sku);
      rows += plans.length;
      console.log(
        `${String(o.invoice_number ?? o.id).padEnd(14)} ${sku.padEnd(16)} ${stage.padEnd(11)} -> ${plans.length} row(s)${o.delivery_url ? "  [has a delivery link]" : ""}`,
      );
      continue;
    }

    const { created, reason } = await createDeliverablesForOrder(db, o.id as string);
    if (!created) {
      console.log(`${String(o.invoice_number ?? o.id).padEnd(14)} ${sku.padEnd(16)} skipped: ${reason}`);
      continue;
    }
    rows += created;

    // name any bundle slots from the brief the customer already submitted
    const intake = (o.metadata as { intake?: { videoSelections?: BundleSelections | null } } | null)
      ?.intake;
    let named = 0;
    if (intake?.videoSelections) {
      named = (await fillBundlePicks(db, o.id as string, intake.videoSelections)).filled;
    }

    // seed status from where the order already is
    const status = STATUS_FROM_STAGE[stage] ?? "queued";
    const patch: Record<string, unknown> = { status };
    if (status === "ready") patch.ready_at = new Date().toISOString();
    await db.from("order_deliverables").update(patch).eq("order_id", o.id);

    // one video owed and one link on file: unambiguous, so carry it across
    let carried = false;
    if (o.delivery_url && created === 1) {
      await db
        .from("order_deliverables")
        .update({ video_url: o.delivery_url })
        .eq("order_id", o.id);
      carried = true;
    }

    console.log(
      `${String(o.invoice_number ?? o.id).padEnd(14)} ${sku.padEnd(16)} ${stage.padEnd(11)} -> ${created} row(s) as ${status}${named ? `, ${named} named from the brief` : ""}${carried ? ", link carried over" : ""}`,
    );
  }

  console.log(`\n${DRY ? "Would create" : "Created"} ${rows} deliverable row(s).`);
  if (DRY) console.log("Dry run, nothing written.");
  else console.log("Verify with: npm run check:deliverables");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
