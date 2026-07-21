import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/* The signed-in customer's own subscriptions. */
export async function GET(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data } = await supabaseAdmin()
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
