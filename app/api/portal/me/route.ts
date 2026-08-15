import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionUser } from "@/lib/account/session";
import { profileByEmail, upsertProfile } from "@/lib/profiles";

export const runtime = "nodejs";

/*
 * The signed-in customer's own profile: contact details from their
 * customers row plus the portal profile layer (photo). PATCH updates the
 * fields they may edit; the email itself stays fixed (it is the key their
 * orders and login hang on; changing it is a write-to-us job).
 */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data }, profile] = await Promise.all([
    db.from("customers").select("name, company, phone").ilike("email", user.email).maybeSingle(),
    profileByEmail(db, user.email),
  ]);

  return NextResponse.json({
    email: user.email,
    name: (data?.name as string | null) ?? profile.displayName ?? null,
    company: (data?.company as string | null) ?? null,
    phone: (data?.phone as string | null) ?? null,
    avatarUrl: profile.avatarUrl,
  });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 120);
  const company = String(body.company ?? "").trim().slice(0, 160);
  const phone = String(body.phone ?? "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db
    .from("customers")
    .upsert(
      { email: user.email, name, company: company || null, phone: phone || null },
      { onConflict: "email" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await upsertProfile(db, user, { displayName: name });
  return NextResponse.json({ ok: true });
}
