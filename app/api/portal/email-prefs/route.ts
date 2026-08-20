import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { EMAIL_CATEGORIES, sanitizePrefs, type EmailPrefs } from "@/lib/email/prefs";

export const runtime = "nodejs";

/*
 * What this client wants to be emailed about.
 *
 * Written against the ACCOUNT, not the person signed in. A teammate changing
 * their own inbox preferences would otherwise silently change the owner's,
 * which is the wrong surprise; the owner's address is the one every
 * transactional email goes to, so it is the one these choices describe.
 */

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });

  const { data } = await db
    .from("customers")
    .select("email_prefs")
    .ilike("email", ctx.ownerEmail)
    .maybeSingle();

  return NextResponse.json({
    categories: EMAIL_CATEGORIES,
    prefs: sanitizePrefs(data?.email_prefs),
    /* said out loud rather than left to be discovered by not receiving one */
    always:
      "Invoices, payment problems, price changes and anything about signing in are always sent. They are about your money and your access.",
  });
}

export async function PUT(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  /* only the account owner sets these, for the reason above */
  if (!ctx.isOwner)
    return NextResponse.json(
      { error: "Only the account owner can change these." },
      { status: 403 },
    );

  const body = (await req.json().catch(() => ({}))) as { prefs?: unknown };
  const prefs: EmailPrefs = sanitizePrefs(body.prefs);

  const { error } = await db
    .from("customers")
    .update({ email_prefs: prefs })
    .ilike("email", ctx.ownerEmail);
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  return NextResponse.json({ ok: true, prefs });
}
