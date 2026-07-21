import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

const STAGES = ["paid", "intake", "production", "review", "delivered"];

/* Update an order's fulfillment fields (stage, producer, PlayBook delivery
 * link, intake flag) and optionally post a customer-facing update. Only these
 * whitelisted fields are writable here; status/amount stay locked to the
 * payment routes. Admin-gated. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();

  const patch: Record<string, unknown> = {};
  if (typeof body.stage === "string" && STAGES.includes(body.stage)) patch.fulfillment_stage = body.stage;
  if (typeof body.manager === "string") patch.assigned_manager = body.manager.trim() || "Tanvir Prince";
  if (typeof body.deliveryUrl === "string") patch.delivery_url = body.deliveryUrl.trim() || null;
  if (typeof body.intakeCompleted === "boolean") patch.intake_completed = body.intakeCompleted;

  if (Object.keys(patch).length) {
    const { error } = await db.from("orders").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (typeof body.update === "string" && body.update.trim()) {
    await db.from("order_updates").insert({ order_id: id, body: body.update.trim() });
  }
  return NextResponse.json({ ok: true });
}
