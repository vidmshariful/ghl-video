import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { parseRetainer } from "@/lib/retainer";
import { signatureOk } from "@/lib/quotes";
import { noteOnContact } from "@/lib/highlevel/sync";
import { likeLiteral } from "@/lib/pg-pattern";

export const runtime = "nodejs";

/*
 * The retainer agreement, accepted in the portal with a typed name (owner
 * decision, 14 September 2026: our page, not a HighLevel document). The
 * acceptance is written onto the terms themselves, with the time and the
 * address it came from; HighLevel gets a note and the agreed-on date in a
 * field through the customer sync. Only the account owner can accept.
 */
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  const { data: c } = await db.from("customers").select("retainer").ilike("email", likeLiteral(ctx.ownerEmail)).maybeSingle();
  const r = parseRetainer(c?.retainer);
  return NextResponse.json({
    agreement: r
      ? {
          name: r.name,
          monthlyCents: r.monthlyCents,
          videosMin: r.videosMin,
          videosMax: r.videosMax,
          activeMax: r.activeMax,
          turnaroundDays: r.turnaroundDays,
          whiteLabel: r.whiteLabel,
          startedOn: r.startedOn,
          note: r.note,
          agreedOn: r.agreedOn,
          agreedBy: r.agreedBy,
        }
      : null,
    canAccept: ctx.selfEmail.toLowerCase() === ctx.ownerEmail.toLowerCase(),
  });
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (ctx.selfEmail.toLowerCase() !== ctx.ownerEmail.toLowerCase())
    return NextResponse.json({ error: "Only the account owner can accept the agreement." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!signatureOk(body.name)) return NextResponse.json({ error: "Type your name to accept." }, { status: 400 });
  const { data: c } = await db.from("customers").select("id, retainer").ilike("email", likeLiteral(ctx.ownerEmail)).maybeSingle();
  const r = parseRetainer(c?.retainer);
  if (!c || !r) return NextResponse.json({ error: "There is no agreement to accept." }, { status: 404 });
  if (r.agreedOn) return NextResponse.json({ ok: true, agreedOn: r.agreedOn, agreedBy: r.agreedBy, note: "already accepted" });
  const name = body.name.trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const agreedOn = new Date().toISOString();
  const { error } = await db
    .from("customers")
    .update({ retainer: { ...r, agreedOn, agreedBy: name, agreedIp: ip }, updated_at: agreedOn })
    .eq("id", String(c.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await noteOnContact(
    db,
    ctx.ownerEmail,
    `${r.name} agreement accepted on ghlvideo.com by ${name}: $${Math.round(r.monthlyCents / 100).toLocaleString("en-US")} a month for ${r.videosMin} to ${r.videosMax} videos.`,
  );
  return NextResponse.json({ ok: true, agreedOn, agreedBy: name });
}
