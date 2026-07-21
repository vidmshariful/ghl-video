import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";

export const runtime = "nodejs";

/* Opens Stripe's hosted billing portal for the signed-in customer, where
 * they change plan, update card, or cancel. Stripe handles it securely; we
 * just mint a session for their Stripe customer and return the URL. */
export async function POST(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: customer } = await supabaseAdmin()
    .from("customers")
    .select("stripe_customer_id")
    .eq("email", email)
    .maybeSingle();
  if (!customer?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet." }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // The Stripe billing portal must be activated in the dashboard first.
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
