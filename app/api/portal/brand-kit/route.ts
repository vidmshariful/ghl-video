import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { brandKitPayload, saveBrandKit } from "@/lib/brand-kit";

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

  /* No customer row means they have never ordered. An empty kit is the
   * honest answer, not an error: there is nothing wrong, there is just
   * nothing yet. Files come back as signed URLs that expire, because a
   * permanent public link to a client's logo would outlive their
   * relationship with us. */
  const customerId = await customerIdFor(db, ctx.ownerEmail);
  return NextResponse.json(await brandKitPayload(db, customerId));
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

  return NextResponse.json({ ok: true, ...(await brandKitPayload(db, customerId)) });
}
