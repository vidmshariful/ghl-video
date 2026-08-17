import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { campaignHref, listCampaigns, pickCampaign, viewerFor } from "@/lib/campaigns";

export const runtime = "nodejs";

/*
 * The one offer this account should see, and nothing else.
 *
 * The audience is worked out here, from the caller's own orders, and never
 * accepted from the browser. Otherwise anybody could ask for the offer aimed
 * at dormant clients by claiming to be one, which would turn a targeted
 * discount into a public one the moment somebody opened dev tools. Same
 * reasoning as prices: if the client can assert it, it is not a rule.
 *
 * Only the chosen offer is returned. Sending the whole list and letting the
 * dashboard choose would leak every offer we are running, including ones
 * aimed at people this person is not.
 */

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  /* Signed out means no offer, not an error. The dashboard is behind a login
   * anyway; this is just refusing to guess. */
  if ("failStatus" in ctx) return NextResponse.json({ campaign: null });

  const now = new Date();
  const [all, viewer] = await Promise.all([
    listCampaigns(db),
    viewerFor(db, ctx.ownerEmail),
  ]);
  const chosen = pickCampaign(all, viewer, now);
  if (!chosen) return NextResponse.json({ campaign: null });

  /*
   * The discount, read from the coupon rather than restated on the offer.
   * A campaign naming a coupon that is missing, switched off, out of date or
   * fully redeemed must not promise money off, because checkout would refuse
   * it and the client would land on a page charging more than the card they
   * just clicked said. Better to show the offer without a number than to show
   * a number we cannot honour.
   */
  let discount: string | null = null;
  if (chosen.couponCode) {
    const { data: c } = await db
      .from("coupons")
      .select("percent_off, amount_off_cents, active, valid_from, valid_until, max_redemptions, redemption_count")
      .eq("code", chosen.couponCode.toUpperCase())
      .maybeSingle();
    const usable =
      c &&
      c.active &&
      (!c.valid_from || new Date(c.valid_from as string) <= now) &&
      (!c.valid_until || new Date(c.valid_until as string) > now) &&
      (c.max_redemptions == null ||
        Number(c.redemption_count) < Number(c.max_redemptions));
    if (usable) {
      discount = c.percent_off
        ? `${c.percent_off}% off`
        : `$${(Number(c.amount_off_cents) / 100).toFixed(0)} off`;
    }
  }

  return NextResponse.json({
    campaign: {
      id: chosen.id,
      title: chosen.title,
      body: chosen.body,
      ctaLabel: chosen.ctaLabel,
      href: campaignHref(chosen),
      discount,
    },
  });
}

/** They clicked it. One atomic bump, and nothing the answer depends on. */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ ok: true });

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (typeof id === "string" && id) {
    await db.rpc("campaign_clicked", { p_id: id });
  }
  /* Always ok: a counter that fails must never stand between somebody and the
   * thing they just clicked. */
  return NextResponse.json({ ok: true });
}
