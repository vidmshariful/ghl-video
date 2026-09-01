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
    .select("id, customer_email, stripe_subscription_id, status, plan_name, current_period_end, cancel_at_period_end")
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

  /*
   * Tell the studio now, not when the plan ends.
   *
   * Stripe sends subscription.deleted when the period actually runs out, and
   * that is where the cancellation alert lived. So a client decided to leave
   * and we found out up to a month later, at the one moment nothing could be
   * done about it. This is the moment somebody could still pick up the phone.
   *
   * Only on a change, so a screen that re-saves the same state does not ring
   * the bell twice. Fail-soft: losing the alert must not fail the client's
   * own request to cancel.
   */
  if (Boolean(sub.cancel_at_period_end) !== cancelAtPeriodEnd) {
    try {
      const { pushAdminNotifications } = await import("@/lib/notifications");
      const plan = (sub.plan_name as string | null) ?? "their plan";
      const ends = sub.current_period_end
        ? new Date(sub.current_period_end as string).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;
      await pushAdminNotifications(db, {
        kind: cancelAtPeriodEnd ? "subscription_cancel_scheduled" : "subscription_cancel_undone",
        title: cancelAtPeriodEnd
          ? `Cancelling: ${email}`
          : `Staying after all: ${email}`,
        body: cancelAtPeriodEnd
          ? `${plan}${ends ? `, runs until ${ends}` : ""}. They can still be reached.`
          : `${plan}. They turned the cancellation off.`,
        href: "subscriptions",
        vars: { plan_name: plan, customer_email: email, ends_at: ends ?? "the end of the period" },
      });
    } catch (e) {
      console.error("[cancel] alert failed:", (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, cancelAtPeriodEnd });
}
