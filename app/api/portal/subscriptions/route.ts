import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/* The acting account's subscriptions (view; changing them needs billing). */
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "subscriptions"))
    return NextResponse.json({ error: "You do not have access to plans." }, { status: 403 });
  const email = ctx.ownerEmail;

  const { data } = await db
    .from("subscriptions")
    .select("id, plan_name, status, amount_cents, currency, interval, current_period_end, cancel_at_period_end")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });

  const subscriptions = (data ?? []).map((s) => ({
    id: s.id,
    planName: s.plan_name,
    status: s.status,
    amountCents: s.amount_cents,
    currency: s.currency,
    interval: s.interval,
    currentPeriodEnd: s.current_period_end,
    cancelAtPeriodEnd: s.cancel_at_period_end,
  }));
  return NextResponse.json({ subscriptions });
}
