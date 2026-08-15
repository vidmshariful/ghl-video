import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { stripe } from "@/lib/checkout/stripe";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/* Opens Stripe's hosted billing portal for the acting account, where plan,
 * card, and cancellation live. Card data on the other side of this URL:
 * team members need the `billing` grant. */
export async function POST(req: Request) {
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

  const { data: customer } = await db
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
      return_url: `${origin}/portal`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // The Stripe billing portal must be activated in the dashboard first. Log
    // the real Stripe reason server-side, but never leak it to the customer.
    console.error("billing portal session failed:", (err as Error).message);
    return NextResponse.json(
      {
        error:
          "Billing is temporarily unavailable. Please email hi@ghlvideo.com and we'll sort it out.",
      },
      { status: 502 },
    );
  }
}
