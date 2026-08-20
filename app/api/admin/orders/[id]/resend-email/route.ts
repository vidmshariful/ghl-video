import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resendOrderEmail } from "@/lib/email/notify";

export const runtime = "nodejs";

/*
 * One click, one email, from a customer's record.
 *
 * Only the two nudges that make sense to re-fire by hand: the confirmation
 * (their receipt, with the intake link inside) and the intake reminder (for
 * an order stuck waiting on the brief). Everything else the platform sends
 * is tied to an event happening, and re-firing an event email without the
 * event is how a client gets told a video is ready twice.
 */
const KINDS = ["order_confirmation", "intake_reminder"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = KINDS.find((k) => k === b.kind);
  if (!kind) return NextResponse.json({ error: "Which email?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  /* a refunded or failed order gets no nudges: the money state won */
  if (order.status !== "paid")
    return NextResponse.json({ error: "That order is not paid." }, { status: 400 });

  const result = await resendOrderEmail(db, id, kind);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
