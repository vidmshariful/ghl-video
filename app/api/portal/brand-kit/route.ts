import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { completeness, getBrandKit, saveBrandKit } from "@/lib/brand-kit";

export const runtime = "nodejs";

/*
 * The client's brand, read and written by the portal.
 *
 * Scoped to the account owner's email, not the signed-in teammate's: a brand
 * belongs to the company, so a team member editing it is editing the same one
 * their colleague sees. That is the whole point of it living on the account.
 *
 * `brand_kits` is default-deny under RLS, so this runs on the service role
 * after the context has proved who the caller is, exactly like orders.
 */

/** The customer row this session's brand belongs to. */
async function customerIdFor(db: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data } = await db.from("customers").select("id").eq("email", email).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });

  const customerId = await customerIdFor(db, ctx.ownerEmail);
  /* No customer row means they have never ordered. An empty kit is the
   * honest answer, not an error: there is nothing wrong, there is just
   * nothing yet. */
  if (!customerId) {
    return NextResponse.json({ kit: null, completeness: completeness(null), logoUrl: null });
  }

  const kit = await getBrandKit(db, customerId);

  /* The logo lives in a private bucket, so it is handed over as a signed URL
   * that expires. A permanent public link to a client's logo would outlive
   * their relationship with us. */
  let logoUrl: string | null = null;
  if (kit?.logoPath) {
    const { data } = await db.storage.from("intake").createSignedUrl(kit.logoPath, 3600);
    logoUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ kit, completeness: completeness(kit), logoUrl });
}

export async function PUT(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const customerId = await customerIdFor(db, ctx.ownerEmail);
  if (!customerId) {
    return NextResponse.json(
      { error: "Your brand kit is created with your first order." },
      { status: 409 },
    );
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : undefined;

  const { error } = await saveBrandKit(db, customerId, {
    brandName: str(b.brandName, 160),
    primaryColor: str(b.primaryColor, 32),
    accentColor: str(b.accentColor, 32),
    pronunciation: str(b.pronunciation, 200),
    notes: str(b.notes, 4000),
  });
  if (error) return NextResponse.json({ error }, { status: 500 });

  const kit = await getBrandKit(db, customerId);
  return NextResponse.json({ ok: true, kit, completeness: completeness(kit) });
}
