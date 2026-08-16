import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { isWatchable, type DeliverableStatus } from "@/lib/deliverable-status";

export const runtime = "nodejs";

/*
 * Every video the acting account has bought, grouped by the order it came in.
 *
 * An order with one video is a single video; an order with several is a pack.
 * The portal shows those as two tabs, so the grouping is decided here rather
 * than in the browser: the client should never have to work out which of their
 * purchases was a pack.
 *
 * The link is withheld until the video is genuinely watchable. Tanvir often
 * pastes a link while a video is still in production, and a client finding an
 * unfinished cut through the portal is exactly the accident this prevents.
 * order_deliverables is default-deny under RLS, so this runs on the service
 * role scoped to the owner's email, like the orders route.
 */
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to orders." }, { status: 403 });
  const email = ctx.ownerEmail;

  const { data: orders } = await db
    .from("orders")
    .select("id, invoice_number, created_at, fulfillment_stage, product:products(name, sku, metadata)")
    .eq("customer_email", email)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o) => o.id as string);
  if (!ids.length) return NextResponse.json({ groups: [] });

  const { data: rows } = await db
    .from("order_deliverables")
    .select("*")
    .in("order_id", ids)
    .order("position");

  const byOrder = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const list = byOrder.get(r.order_id as string) ?? [];
    list.push(r);
    byOrder.set(r.order_id as string, list as typeof rows);
  }

  const groups = (orders ?? [])
    .map((o) => {
      const list = byOrder.get(o.id as string) ?? [];
      if (!list.length) return null;
      const product = o.product as unknown as {
        name: string;
        sku: string;
        metadata: { code?: string } | null;
      } | null;

      return {
        orderId: o.id as string,
        invoiceNumber: o.invoice_number as string | null,
        orderedAt: o.created_at as string,
        productName: product?.name ?? "Your order",
        productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
        // one video is a video, several is a pack. The two portal tabs.
        kind: list.length > 1 ? ("pack" as const) : ("video" as const),
        videos: list.map((d) => {
          const status = d.status as DeliverableStatus;
          return {
            id: d.id as string,
            title: d.title as string,
            code: d.catalog_code as string | null,
            category: d.category as string | null,
            groupLabel: d.group_label as string | null,
            status,
            revisionRound: d.revision_round as number,
            // withheld on purpose until it is ready to watch
            videoUrl: isWatchable(status) ? ((d.video_url as string | null) ?? null) : null,
            readyAt: d.ready_at as string | null,
            approvedAt: d.approved_at as string | null,
          };
        }),
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return NextResponse.json({ groups });
}
