import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureAuthAccount } from "@/lib/checkout/account";

export const runtime = "nodejs";

/*
 * Invite a partner: create their Supabase login (no password, idempotent)
 * and move an application to 'invited'. The partner then sets a password
 * from the /partners sign-in page ("set it by email"), the same flow the
 * team and customers already use. Everything else about the partner row is
 * managed straight from the admin screen via RLS; only this auth-account
 * step needs the service role, which is why it is an API route.
 */
export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing partner id." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: partner, error } = await db
    .from("partners")
    .select("id, email, status")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  if (!partner.email)
    return NextResponse.json(
      { error: "Set the partner's email first, then invite them." },
      { status: 400 },
    );

  await ensureAuthAccount(partner.email);

  if (partner.status === "applied" || partner.status === "rejected") {
    const { error: upErr } = await db
      .from("partners")
      .update({ status: "invited" })
      .eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
