import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * What is coming, who wants it, and whether it can be preordered.
 *
 * Browsing works signed out, same rule as the library: nobody should need an
 * account to look. Signing in adds two things: whether YOU have voted, and
 * the right to vote.
 *
 * Preorder is not a second checkout. A coming video that has a priced,
 * active product row is simply buyable at /checkout/<code>/ like anything
 * else, and the studio delivers when it ships. No product row, no preorder
 * button; the vote is the whole offer. That keeps the money path single.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const db = supabaseAdmin();

  const [{ data: upcoming }, { data: votes }, { data: products }] = await Promise.all([
    db
      .from("catalog")
      .select("code, title, subject, category, kind, poster_url, sort")
      .eq("coming_soon", true)
      .order("sort"),
    db.from("catalog_votes").select("code, customer_email"),
    db.from("products").select("sku, price_cents, active"),
  ]);

  const priced = new Map(
    ((products ?? []) as Row[])
      .filter((p) => p.active)
      .map((p) => [String(p.sku), Number(p.price_cents)]),
  );

  const ctx = await resolvePortalContext(db, req, "customer");
  const me = "failStatus" in ctx ? null : ctx.ownerEmail.toLowerCase();

  const voteRows = (votes ?? []) as { code: string; customer_email: string }[];
  const countFor = (code: string) => voteRows.filter((v) => v.code === code).length;
  const minedFor = (code: string) =>
    Boolean(me && voteRows.some((v) => v.code === code && v.customer_email.toLowerCase() === me));

  const items = ((upcoming ?? []) as Row[]).map((c) => {
    const code = String(c.code);
    return {
      code,
      title: String(c.title),
      subject: (c.subject as string | null) ?? null,
      category: (c.category as string | null) ?? null,
      posterUrl: (c.poster_url as string | null) ?? null,
      votes: countFor(code),
      voted: minedFor(code),
      /* priced and switched on means preorderable through normal checkout */
      preorderCents: priced.get(code) ?? null,
    };
  });

  return NextResponse.json({ items, signedIn: Boolean(me) });
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Sign in to vote." }, { status: ctx.failStatus });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code.toLowerCase().trim() : "";
  const note =
    typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 1000) : null;

  /* only rows that are actually marked coming: a vote for an arbitrary
   * string is noise at best */
  const { data: row } = await db
    .from("catalog")
    .select("code")
    .eq("code", code)
    .eq("coming_soon", true)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { error } = await db.from("catalog_votes").upsert(
    {
      code,
      customer_email: ctx.ownerEmail.toLowerCase(),
      /* a repeat vote with a note keeps the note; without one it keeps the old */
      ...(note ? { note } : {}),
    },
    { onConflict: "code,customer_email" },
  );
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
