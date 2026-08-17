import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { listCampaigns } from "@/lib/campaigns";

export const runtime = "nodejs";

/*
 * Offers, managed from admin.
 *
 * The list comes back with the named coupon resolved beside each offer, so the
 * screen can say what the discount actually is and, more usefully, when there
 * is no longer a coupon behind it. An offer promising money off that checkout
 * will refuse is the worst failure this feature has, and it happens quietly:
 * somebody deletes a coupon months later and the offer keeps running. So the
 * screen is built to show that, rather than to hide it behind a green tick.
 */

type Body = Record<string, unknown>;

const AUDIENCES = ["all", "customers", "prospects", "dormant"] as const;

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Shared by create and update, so the two can never drift apart. */
function fieldsFrom(b: Body) {
  const audience = AUDIENCES.includes(b.audience as (typeof AUDIENCES)[number])
    ? (b.audience as string)
    : "all";
  return {
    title: str(b.title, 120),
    body: str(b.body, 400),
    cta_label: str(b.ctaLabel, 40) ?? "See the offer",
    /* stored lowercase because that is what /checkout/[sku] expects */
    target_sku: str(b.targetSku, 64)?.toLowerCase() ?? null,
    target_path: str(b.targetPath, 200),
    /* coupons are uppercase by table constraint, so match it here */
    coupon_code: str(b.couponCode, 32)?.toUpperCase() ?? null,
    audience,
    dormant_days: Math.min(730, Math.max(7, Number(b.dormantDays) || 90)),
    starts_at: str(b.startsAt, 40),
    ends_at: str(b.endsAt, 40),
    priority: Math.min(999, Math.max(0, Number(b.priority) || 0)),
    active: Boolean(b.active),
  };
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const campaigns = await listCampaigns(db);

  /* every coupon an offer names, in one query rather than one per offer */
  const codes = [...new Set(campaigns.map((c) => c.couponCode).filter(Boolean))] as string[];
  const { data: coupons } = codes.length
    ? await db
        .from("coupons")
        .select("code, percent_off, amount_off_cents, active, valid_until, max_redemptions, redemption_count")
        .in("code", codes)
    : { data: [] };
  const byCode = new Map(
    ((coupons ?? []) as Record<string, unknown>[]).map((c) => [String(c.code), c]),
  );

  return NextResponse.json({
    campaigns: campaigns.map((c) => {
      const coupon = c.couponCode ? byCode.get(c.couponCode) : undefined;
      return {
        ...c,
        coupon: coupon
          ? {
              code: String(coupon.code),
              label: coupon.percent_off
                ? `${coupon.percent_off}% off`
                : `$${(Number(coupon.amount_off_cents) / 100).toFixed(0)} off`,
              active: Boolean(coupon.active),
              redemptions: Number(coupon.redemption_count ?? 0),
              maxRedemptions: (coupon.max_redemptions as number | null) ?? null,
            }
          : null,
        /* the quiet failure, named plainly */
        couponMissing: Boolean(c.couponCode && !coupon),
      };
    }),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const fields = fieldsFrom(b);
  if (!fields.title) {
    return NextResponse.json({ error: "Give the offer a title." }, { status: 400 });
  }
  if (!fields.target_sku && !fields.target_path) {
    return NextResponse.json(
      { error: "An offer needs somewhere to go: a sku or a path." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("campaigns")
    .insert(fields)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const id = str(b.id, 64);
  if (!id) return NextResponse.json({ error: "Which offer?" }, { status: 400 });

  /* The switch on its own, so turning an offer off never has to re-post a
   * whole form and never risks saving a half-edited draft live. */
  if (Object.keys(b).length === 2 && "active" in b) {
    const { error } = await supabaseAdmin()
      .from("campaigns")
      .update({ active: Boolean(b.active) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const fields = fieldsFrom(b);
  if (!fields.title) return NextResponse.json({ error: "Give the offer a title." }, { status: 400 });
  if (!fields.target_sku && !fields.target_path) {
    return NextResponse.json(
      { error: "An offer needs somewhere to go: a sku or a path." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin().from("campaigns").update(fields).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which offer?" }, { status: 400 });

  const { error } = await supabaseAdmin().from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
