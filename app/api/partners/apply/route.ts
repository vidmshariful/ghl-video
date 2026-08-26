import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/*
 * Tier 1 affiliate signup (from /partners/apply and the customer portal),
 * AUTO-APPROVED per the program document: the partners row is created
 * active, their login exists immediately, a FirstPromoter promoter is
 * created with the same ref token so their ?ref= link tracks from minute
 * one, and the welcome email carries the way into the portal. The team
 * gets a joined alert instead of a review queue. VIP and Partnership
 * tiers never enter here (invitation and contract only).
 * Honeypot + per-IP rate limit, same discipline as the quote form.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`partner-apply:${clientIp(req)}`, 3, 600_000); // 3 per 10 min
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // honeypot: real people never fill this hidden field
  if (s(body.website, 200)) return NextResponse.json({ ok: true });

  const name = s(body.name, 120);
  const email = s(body.email, 200).toLowerCase();
  const company = s(body.company, 160);
  const channel = s(body.channel, 120);
  const audience = s(body.audience, 200);
  const links = s(body.links, 600);
  const message = s(body.message, 2000);

  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!EMAIL_RE.test(email))
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!message)
    return NextResponse.json(
      { error: "Tell us a little about how you would promote GHL Video." },
      { status: 400 },
    );

  // suggest a ref from the name; uniquified with a suffix if taken. The team
  // sets the final slug at approval, this only has to not collide.
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) ||
    "partner";
  const suffix = Math.abs(
    [...email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7),
  )
    .toString(36)
    .slice(0, 4);

  const application = { company, channel, audience, links, message, submittedAt: new Date().toISOString() };

  const db = supabaseAdmin();
  const insert = (ref: string) =>
    db
      .from("partners")
      .insert({ ref, name, email, status: "active", tier: "affiliate", application })
      .select("id, ref")
      .single();

  let { data: row, error } = await insert(base);
  if (error?.code === "23505" && /partners_ref_key|partners\.ref/i.test(error.message ?? "")) {
    ({ data: row, error } = await insert(`${base}-${suffix}`));
  }
  if (error || !row) {
    if (error?.code === "23505") {
      // one row per email: an account already exists
      return NextResponse.json({
        ok: true,
        note: "We already have this email on file. Sign in at /partners to open your portal.",
      });
    }
    console.error("partner apply failed:", error?.message);
    return NextResponse.json(
      { error: "Something went wrong. Please email hi@ghlvideo.com and we'll set you up." },
      { status: 502 },
    );
  }

  // their login, from minute one (they set a password from the sign-in page)
  const { ensureAuthAccount } = await import("@/lib/checkout/account");
  await ensureAuthAccount(email);

  /*
   * Their Affixo affiliate, carrying the same ref as their link. Fail-soft:
   * the portal shows its graceful not-linked card until the team fixes it.
   *
   * This created a FirstPromoter promoter until FirstPromoter was retired.
   * Left alone it would have been the worst kind of leftover: a partner who
   * applied would have been set up correctly in a platform we no longer pay
   * from, and would have had no affiliate at all in the one we do. Every
   * referral they sent would have resolved to nobody.
   */
  const { createAffiliate } = await import("@/lib/affixo");
  const affiliate = await createAffiliate({ email, name, ref: row.ref });
  if (affiliate) {
    await db
      .from("partners")
      .update({ affixo_affiliate_id: affiliate.id })
      .eq("id", row.id);
  }

  // welcome email with the way in + team joined alert; never blocks
  const { sendAffiliateJoinedEmails } = await import("@/lib/email/notify");
  await sendAffiliateJoinedEmails(db, { email, name, channel, audience });
  return NextResponse.json({ ok: true, approved: true });
}
