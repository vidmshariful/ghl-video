import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/* Refund a paid order: issues the Stripe refund, then marks the order
 * refunded and logs it. Admin-gated. The UI confirms before calling. */
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
    return NextResponse.json({ error: "Only paid orders can be refunded." }, { status: 400 });
  }
  if (!order.stripe_payment_intent_id) {
    return NextResponse.json({ error: "No payment to refund." }, { status: 400 });
  }

  try {
    // Idempotency key: a double-click or retry returns the same refund instead
    // of issuing a second one.
    await stripe().refunds.create(
      { payment_intent: order.stripe_payment_intent_id },
      { idempotencyKey: `refund_${order.id}` },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Stripe refund failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Conditional flip (only the first refund of a paid order wins) closes the
  // check-then-act race and logs the event exactly once.
  const { data: flipped } = await db
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", id)
    .eq("status", "paid")
    .select("id")
    .maybeSingle();
  if (flipped) {
    await db.from("order_events").insert({
      order_id: id,
      event_type: "refunded",
      payload: { by: admin.email },
    });

    /*
     * Tell the customer, from here.
     *
     * Stripe's charge.refunded arrives moments later and would normally send
     * this, but only inside its own "did I just flip this" guard. The flip
     * above has already happened, so that guard finds nothing to change and
     * the mail never goes. Nobody has hit this yet because no screen calls
     * this route, which is the only reason it has not already cost somebody a
     * refund nobody told them about. Sending it here closes the trap before a
     * button is ever wired to it.
     *
     * Safe against a double send for the same reason it is needed: only one
     * of the two flips can win, and only the winner mails.
     */
    const { sendOrderRefundedEmail } = await import("@/lib/email/notify");
    await sendOrderRefundedEmail(db, id, Number(order.amount_cents ?? 0));
  }
  return NextResponse.json({ ok: true });
}
