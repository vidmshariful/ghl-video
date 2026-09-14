import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseRetainer } from "@/lib/retainer";
import { sendAgreementReadyEmail } from "@/lib/email/notify";

export const runtime = "nodejs";

/*
 * "Send the agreement": the partner is told the terms are on their portal
 * to read and accept. By hand, from the client record, because sending a
 * contract is a person's call.
 */
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const db = supabaseAdmin();
  const { data: c } = await db.from("customers").select("email, name, retainer").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const r = parseRetainer(c.retainer);
  if (!r) return NextResponse.json({ error: "Set the retainer terms first." }, { status: 400 });
  const feeLine = `$${Math.round(r.monthlyCents / 100).toLocaleString("en-US")} a month, paid upfront on the first, for ${r.videosMin} to ${r.videosMax} videos, ${r.activeMax} in production at a time, ${r.turnaroundDays} business days each${r.whiteLabel ? ", every one with a white-label version" : ""}.`;
  const sent = await sendAgreementReadyEmail(db, {
    email: String(c.email),
    name: (c.name as string | null) ?? null,
    partnershipName: r.name,
    feeLine,
  });
  return NextResponse.json({ ok: sent, error: sent ? undefined : "Not sent. The email log has the reason." });
}
