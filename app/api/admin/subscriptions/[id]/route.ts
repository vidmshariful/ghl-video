import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/* Admin subscription actions: cancel at period end, cancel immediately, or
 * resume (clear a pending cancel). Stripe is authoritative; the DB is updated
 * optimistically and the webhook reconciles. Admin-gated. */
const ACTIONS = ["cancel_period_end", "cancel_now", "resume"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (!ACTIONS.includes(body.action as Action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const action = body.action as Action;

  const db = supabaseAdmin();
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, stripe_subscription_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  if (!sub.stripe_subscription_id) {
    return NextResponse.json({ error: "No Stripe subscription linked." }, { status: 400 });
  }

  try {
    if (action === "cancel_now") {
      await stripe().subscriptions.cancel(sub.stripe_subscription_id);
      await db
        .from("subscriptions")
        .update({ status: "canceled", cancel_at_period_end: false })
        .eq("id", id);
    } else {
      const cancel = action === "cancel_period_end";
      await stripe().subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: cancel,
      });
      await db.from("subscriptions").update({ cancel_at_period_end: cancel }).eq("id", id);
    }
  } catch (err) {
    return NextResponse.json({ error: `Stripe: ${(err as Error).message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
