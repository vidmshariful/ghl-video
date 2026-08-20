import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { resolveList } from "@/lib/shared-lists";

export const runtime = "nodejs";

/*
 * Making and keeping a shortlist to send somebody.
 *
 * The list belongs to the ACCOUNT rather than to whoever is signed in, so a
 * teammate who builds it and an owner who shares it are working on the same
 * thing. That is the whole scenario: more than one person deciding.
 */

const MAX_ITEMS = 24;
const MAX_LISTS = 20;

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const { data } = await db
    .from("shared_lists")
    .select("token, title, item_codes, quoted_cents, opened_count, requested_at, created_at")
    .ilike("owner_email", ctx.ownerEmail)
    .order("created_at", { ascending: false })
    .limit(MAX_LISTS);

  return NextResponse.json({
    lists: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      token: String(r.token),
      title: String(r.title),
      count: ((r.item_codes as string[]) ?? []).length,
      totalCents: Number(r.quoted_cents ?? 0),
      /* the number that says whether sharing it did anything */
      opened: Number(r.opened_count ?? 0),
      requestedAt: (r.requested_at as string | null) ?? null,
      createdAt: String(r.created_at),
      href: `/list/${String(r.token)}/`,
    })),
  });
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const codes = Array.isArray(b.codes)
    ? [
        ...new Set(
          (b.codes as unknown[])
            .filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
            .map((c) => c.trim().toLowerCase()),
        ),
      ].slice(0, MAX_ITEMS)
    : [];
  if (!codes.length)
    return NextResponse.json({ error: "Pick at least one video first." }, { status: 400 });

  const title =
    typeof b.title === "string" && b.title.trim()
      ? b.title.trim().slice(0, 120)
      : "Videos we are considering";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : null;

  /* Price it once, now, from the products table checkout charges against.
   * Stored so a later price change cannot rewrite what somebody was shown. */
  const { data: products } = await db
    .from("products")
    .select("sku, price_cents, active")
    .in("sku", codes);
  const quoted = ((products ?? []) as Record<string, unknown>[])
    .filter((p) => p.active)
    .reduce((s, p) => s + Number(p.price_cents ?? 0), 0);

  const { data: made, error } = await db
    .from("shared_lists")
    .insert({
      owner_email: ctx.ownerEmail.toLowerCase(),
      owner_name: typeof b.ownerName === "string" ? b.ownerName.slice(0, 120) : null,
      title,
      note: note || null,
      item_codes: codes,
      quoted_cents: quoted,
    })
    .select("token")
    .single();
  if (error || !made)
    return NextResponse.json({ error: "Could not make that list." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    token: String(made.token),
    href: `/list/${String(made.token)}/`,
    list: await resolveList(db, String(made.token)),
  });
}

export async function DELETE(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Which list?" }, { status: 400 });

  /* scoped to their account, so a token from somewhere else deletes nothing */
  await db
    .from("shared_lists")
    .delete()
    .eq("token", token)
    .ilike("owner_email", ctx.ownerEmail);
  return NextResponse.json({ ok: true });
}
