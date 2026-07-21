import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncPaidOrderToHighLevel } from "@/lib/checkout/fulfill";

export const runtime = "nodejs";

/* Manually re-run the HighLevel sync for a paid order that failed to sync.
 * Admin-gated. No-ops (does not duplicate) if the order already synced. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json({ error: "Only paid orders sync to HighLevel." }, { status: 400 });
  }
  if (order.highlevel_opportunity_id) {
    return NextResponse.json({ ok: true, alreadySynced: true });
  }

  const result = await syncPaidOrderToHighLevel(db, order);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
