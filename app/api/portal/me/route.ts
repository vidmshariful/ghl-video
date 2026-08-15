import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionUser } from "@/lib/account/session";
import { profileByEmail, upsertProfile } from "@/lib/profiles";
import { membershipsForMember, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * Who is signed in and which account they are working in. Owners get their
 * own contact details; team members get their own profile plus the owner's
 * name and their grant list. `memberships` powers the account switcher in
 * the top bar for people who serve several accounts.
 */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized" }, { status: ctx.failStatus });

  const [profile, allMemberships] = await Promise.all([
    profileByEmail(db, user.email),
    membershipsForMember(db, "customer", user.email),
  ]);
  // a paused membership is not an account you can enter
  const memberships = allMemberships.filter((m) => m.status !== "paused");

  // names for the switcher entries
  const ownerEmails = memberships.map((m) => m.owner_email);
  let ownerNames: Record<string, string | null> = {};
  if (ownerEmails.length > 0) {
    const { data } = await db.from("customers").select("email, name").in("email", ownerEmails);
    ownerNames = Object.fromEntries(
      (data ?? []).map((c) => [(c.email as string).toLowerCase(), (c.name as string | null) ?? null]),
    );
  }

  const base = {
    email: user.email,
    avatarUrl: profile.avatarUrl,
    isOwner: ctx.isOwner,
    features: ctx.features,
    memberships: memberships.map((m) => ({
      ownerEmail: m.owner_email,
      ownerName: ownerNames[m.owner_email] ?? null,
      status: m.status,
    })),
  };

  if (ctx.isOwner) {
    const { data } = await db
      .from("customers")
      .select("name, company, phone")
      .ilike("email", user.email)
      .maybeSingle();
    return NextResponse.json({
      ...base,
      name: (data?.name as string | null) ?? profile.displayName ?? null,
      company: (data?.company as string | null) ?? null,
      phone: (data?.phone as string | null) ?? null,
      actingFor: null,
    });
  }

  const { data: owner } = await db
    .from("customers")
    .select("name")
    .ilike("email", ctx.ownerEmail)
    .maybeSingle();
  return NextResponse.json({
    ...base,
    name: profile.displayName ?? null,
    company: null,
    phone: null,
    actingFor: {
      email: ctx.ownerEmail,
      name: (owner?.name as string | null) ?? null,
    },
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
  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });

  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized" }, { status: ctx.failStatus });

  // a team member edits only their own display name, never the owner's
  // account details
  if (!ctx.isOwner) {
    await upsertProfile(db, user, { displayName: name });
    return NextResponse.json({ ok: true });
  }

  const company = String(body.company ?? "").trim().slice(0, 160);
  const phone = String(body.phone ?? "").trim().slice(0, 40);
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
