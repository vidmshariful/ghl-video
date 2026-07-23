import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/*
 * Native subscription management for the signed-in customer: set (or clear)
 * cancel-at-period-end without leaving the site. Scoped to the caller's own
 * subscription by verified session email (404, not 403, on mismatch so it
 * never confirms another customer's subscription exists). Stripe is the source
 * of truth; the DB is updated optimistically and the webhook reconciles it.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, customer_email, stripe_subscription_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!sub || sub.customer_email !== email) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!sub.stripe_subscription_id) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { cancelAtPeriodEnd?: boolean };
  const cancelAtPeriodEnd = body.cancelAtPeriodEnd !== false; // default: cancel

  try {
    await stripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  } catch (err) {
    console.error("portal subscription update failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Could not update your plan. Please email hi@ghlvideo.com." },
      { status: 502 },
    );
  }

  await db.from("subscriptions").update({ cancel_at_period_end: cancelAtPeriodEnd }).eq("id", id);
  return NextResponse.json({ ok: true, cancelAtPeriodEnd });
}
