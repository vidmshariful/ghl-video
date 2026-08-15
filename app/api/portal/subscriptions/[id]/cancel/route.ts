import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * Native subscription management: set (or clear) cancel-at-period-end
 * without leaving the site. Money-adjacent, so team members need the
 * `billing` grant, not just view access. Scoped to the acting account's
 * subscription (404, not 403, on mismatch so it never confirms another
 * customer's subscription exists). Stripe is the source of truth; the DB
 * is updated optimistically and the webhook reconciles it.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "billing"))
    return NextResponse.json(
      { error: "Billing changes are limited on your access." },
      { status: 403 },
    );
  const email = ctx.ownerEmail;

  const { id } = await params;
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
