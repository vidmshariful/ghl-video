import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionUser } from "@/lib/account/session";
import { profileByEmail, upsertProfile } from "@/lib/profiles";

export const runtime = "nodejs";

/*
 * The signed-in admin's own identity: email, name, role, features, plus the
 * profile layer (display name + photo) for the top bar. The admin shell
 * reads this once after login to gate the menu; PATCH lets any admin edit
 * their own name (it writes both the profile and their admins row, so the
 * Team screen and chat sender names stay in step).
 */
export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data }, profile] = await Promise.all([
    db.from("admins").select("email, name, role, features"),
    profileByEmail(db, auth.email),
  ]);
  const row = (data ?? []).find(
    (r) => (r.email ?? "").toLowerCase() === auth.email.toLowerCase(),
  );

  const name = profile.displayName ?? ((row?.name as string | null) ?? null);
  return NextResponse.json({
    email: auth.email,
    name,
    role: (row?.role as string | undefined) ?? "manager",
    features: (row?.features as string[] | null | undefined) ?? null,
    avatarUrl: profile.avatarUrl,
  });
}

export async function PATCH(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });

  const db = supabaseAdmin();
  await upsertProfile(db, user, { displayName: name });
  const { error } = await db.from("admins").update({ name }).eq("email", auth.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
