import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * A share list made by anyone, from the public library.
 *
 * Same table and same /list/<token> page as the portal's version; the only
 * difference is that the row has no owner, because the person picking six
 * videos to show a cofounder does not have an account yet, and asking them
 * to make one first is the wall the public library exists to remove.
 */

const MAX_ITEMS = 24;

export async function POST(req: Request) {
  const rl = rateLimit(`pubList:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "Too many lists. Give it a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );

  const b = (await req.json().catch(() => ({}))) as { codes?: unknown };
  const wanted = Array.isArray(b.codes)
    ? [
        ...new Set(
          (b.codes as unknown[])
            .filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
            .map((c) => c.trim().toLowerCase()),
        ),
      ].slice(0, MAX_ITEMS)
    : [];
  if (!wanted.length)
    return NextResponse.json({ error: "Pick at least one video first." }, { status: 400 });

  const db = supabaseAdmin();
  /* only real, public rows make it onto a list somebody can forward */
  const { data: rows } = await db
    .from("catalog")
    .select("code")
    .in("code", wanted)
    .eq("on_site", true);
  const codes = wanted.filter((c) =>
    ((rows ?? []) as { code: string }[]).some((r) => String(r.code).toLowerCase() === c),
  );
  if (!codes.length)
    return NextResponse.json({ error: "Those are not in the library." }, { status: 400 });

  /* priced from the rows checkout charges against, stored so a later price
   * change cannot rewrite what somebody was shown */
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
      owner_email: null,
      title: "Videos we are considering",
      item_codes: codes,
      quoted_cents: quoted,
      source: "library",
    })
    .select("token")
    .single();
  if (error || !made)
    return NextResponse.json({ error: "Could not make that list." }, { status: 500 });

  return NextResponse.json({ ok: true, href: `/list/${String(made.token)}/` });
}
