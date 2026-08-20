import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { campaignHref, matchesAudience, rowToCampaign, viewerFor } from "@/lib/campaigns";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml, wrapEmail, SITE_URL } from "@/lib/email/templates";

export const runtime = "nodejs";

/*
 * Email an offer to the people it is aimed at.
 *
 * This is the half of campaigns that reaches a dormant client, who by
 * definition does not log in to see the dashboard slot. It is a deliberate
 * button in admin, not a scheduler: Shariful presses it when he means it,
 * previews the count first, and campaign_sends guarantees each person gets a
 * given offer once, ever, no matter how often the button is pressed.
 *
 * Only "customers" and "dormant" audiences can be emailed. Both are people
 * who have paid us, where a service relationship exists. "Everyone" and
 * "prospects" include accounts that never bought anything, and emailing a
 * discount to somebody who only ever made a login is the kind of message
 * that gets a sender flagged. The dashboard slot still serves those two.
 */

const EMAILABLE = new Set(["customers", "dormant"]);

function offerEmailHtml(opts: {
  title: string;
  body: string | null;
  discount: string | null;
  ctaLabel: string;
  href: string;
  name: string | null;
}): string {
  const inner = `
    ${opts.name ? `<p style="margin:0 0 14px;font-size:15px;color:#101523;">Hi ${escapeHtml(opts.name)},</p>` : ""}
    <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#101523;">${escapeHtml(opts.title)}</h1>
    ${opts.body ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#545c6d;">${escapeHtml(opts.body)}</p>` : ""}
    ${
      opts.discount
        ? `<p style="margin:0 0 18px;"><span style="display:inline-block;padding:5px 12px;border:1px solid #00CC00;border-radius:999px;font-size:13px;font-weight:600;color:#0a7a0a;">${escapeHtml(opts.discount)}, applied at checkout</span></p>`
        : ""
    }
    <p style="margin:0 0 22px;">
      <a href="${SITE_URL}${opts.href}" style="display:inline-block;padding:12px 26px;background:linear-gradient(100deg,#FCC000,#00CC00);color:#08090D;font-weight:700;font-size:15px;text-decoration:none;border-radius:3px;">${escapeHtml(opts.ctaLabel)}</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8a91a0;">
      You are getting this because you are a GHL Video client. If you would
      rather not hear about offers, reply to this email and we will stop.
    </p>`;
  return wrapEmail(inner);
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { id?: string; dryRun?: boolean };
  if (!b.id) return NextResponse.json({ error: "Which offer?" }, { status: 400 });
  const dryRun = Boolean(b.dryRun);

  const db = supabaseAdmin();
  const { data: row } = await db.from("campaigns").select("*").eq("id", b.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "That offer no longer exists." }, { status: 404 });
  const campaign = rowToCampaign(row);

  if (!EMAILABLE.has(campaign.audience)) {
    return NextResponse.json(
      {
        error:
          "Only offers aimed at buyers can be emailed: people who never bought would be getting marketing they did not ask for. Aim it at customers or quiet clients first.",
      },
      { status: 400 },
    );
  }
  if (!campaign.active) {
    return NextResponse.json(
      { error: "Switch the offer on first, so the email and the portal agree." },
      { status: 400 },
    );
  }

  /* The discount named on the coupon, resolved the same way the portal does:
   * from the coupon row, never restated, so the email cannot promise money
   * off that checkout would refuse. */
  let discount: string | null = null;
  if (campaign.couponCode) {
    const now = new Date();
    const { data: c } = await db
      .from("coupons")
      .select("percent_off, amount_off_cents, active, valid_from, valid_until, max_redemptions, redemption_count")
      .eq("code", campaign.couponCode.toUpperCase())
      .maybeSingle();
    const usable =
      c &&
      c.active &&
      (!c.valid_from || new Date(c.valid_from as string) <= now) &&
      (!c.valid_until || new Date(c.valid_until as string) > now) &&
      (c.max_redemptions == null || Number(c.redemption_count) < Number(c.max_redemptions));
    if (!usable) {
      return NextResponse.json(
        {
          error: `Code ${campaign.couponCode} is missing, off, expired or used up. Fix the coupon before emailing a promise checkout will refuse.`,
        },
        { status: 400 },
      );
    }
    discount = c.percent_off
      ? `${c.percent_off}% off`
      : `$${(Number(c.amount_off_cents) / 100).toFixed(0)} off`;
  }

  /* every buyer we know, then the campaign's own audience rules decide */
  const { data: customers } = await db.from("customers").select("email, name, email_prefs");
  const { data: already } = await db
    .from("campaign_sends")
    .select("customer_email")
    .eq("campaign_id", campaign.id);
  const sentBefore = new Set(
    ((already ?? []) as { customer_email: string }[]).map((r) => r.customer_email.toLowerCase()),
  );

  const now = new Date();
  const matched: { email: string; name: string | null }[] = [];
  let alreadyCount = 0;
  let optedOut = 0;
  for (const c of (customers ?? []) as {
    email: string;
    name: string | null;
    email_prefs?: Record<string, boolean> | null;
  }[]) {
    const email = c.email.toLowerCase();
    /* somebody who switched offers off is not an audience, whatever the
     * targeting says. Checked before the sent-before list so an opt-out
     * never quietly consumes their one-and-only send. */
    if (c.email_prefs?.offers === false) {
      optedOut += 1;
      continue;
    }
    const viewer = await viewerFor(db, email);
    if (!matchesAudience(campaign, viewer, now)) continue;
    if (sentBefore.has(email)) {
      alreadyCount += 1;
      continue;
    }
    matched.push({ email, name: c.name });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      matched: matched.length,
      alreadySent: alreadyCount,
      optedOut,
    });
  }
  if (!matched.length) {
    return NextResponse.json({ ok: true, sent: 0, alreadySent: alreadyCount, optedOut });
  }

  const href = campaignHref(campaign);
  let sent = 0;
  let firstError: string | null = null;
  for (const person of matched) {
    const result = await sendEmail({
      to: person.email,
      toName: person.name,
      subject: campaign.title,
      html: offerEmailHtml({
        title: campaign.title,
        body: campaign.body,
        discount,
        ctaLabel: campaign.ctaLabel,
        href,
        name: person.name,
      }),
    });
    if (!result.ok) {
      /* the first failure is usually the whole story (no key, bad sender);
       * stop rather than hammer Brevo with the same mistake N times */
      firstError = result.error ?? "Send failed.";
      break;
    }
    /* upsert-ignore: two admins pressing send together must not crash the
     * loop, and the unique pair already guarantees one email per person */
    await db
      .from("campaign_sends")
      .upsert(
        { campaign_id: campaign.id, customer_email: person.email },
        { onConflict: "campaign_id,customer_email", ignoreDuplicates: true },
      );
    sent += 1;
  }

  if (firstError && sent === 0) {
    return NextResponse.json({ error: firstError }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    sent,
    alreadySent: alreadyCount,
    ...(firstError ? { stoppedEarly: firstError } : {}),
  });
}
