import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * A shared shortlist, resolved into something a page can render.
 *
 * The codes are stored, the prices are looked up. Two reasons: a list is
 * about which videos, not about a moment in the price list, and the products
 * table is the only row checkout charges against, so quoting from anywhere
 * else risks showing a number the card is not charged.
 *
 * The total shown when it was SHARED is kept on the row as well, so if a
 * price moves between the share and the reply we can see that it did rather
 * than quietly restating history.
 */

export type ListItem = {
  code: string;
  title: string;
  category: string | null;
  kind: string;
  posterUrl: string | null;
  priceCents: number;
  /* the checkout url for this one on its own */
  buyHref: string | null;
};

export type ResolvedList = {
  token: string;
  title: string;
  note: string | null;
  ownerName: string | null;
  items: ListItem[];
  totalCents: number;
  quotedCents: number;
  /* true when a price has moved since it was shared */
  priceChanged: boolean;
  requestedAt: string | null;
  createdAt: string;
};

export async function resolveList(
  db: SupabaseClient,
  token: string,
): Promise<ResolvedList | null> {
  const { data: row } = await db
    .from("shared_lists")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!row) return null;

  const codes = ((row.item_codes as string[]) ?? []).map((c) => c.toLowerCase());
  if (!codes.length) {
    return {
      token: String(row.token),
      title: String(row.title),
      note: (row.note as string | null) ?? null,
      ownerName: (row.owner_name as string | null) ?? null,
      items: [],
      totalCents: 0,
      quotedCents: Number(row.quoted_cents ?? 0),
      priceChanged: false,
      requestedAt: (row.requested_at as string | null) ?? null,
      createdAt: String(row.created_at),
    };
  }

  const [{ data: catalog }, { data: products }] = await Promise.all([
    db.from("catalog").select("code, title, category, kind, poster_url").in("code", codes),
    db.from("products").select("sku, price_cents, active").in("sku", codes),
  ]);

  const priced = new Map(
    ((products ?? []) as Record<string, unknown>[]).map((p) => [
      String(p.sku),
      { cents: Number(p.price_cents), active: Boolean(p.active) },
    ]),
  );

  /* kept in the order they were picked: somebody built this list in an order
   * that meant something to them */
  const items: ListItem[] = codes
    .map((code) => {
      const c = ((catalog ?? []) as Record<string, unknown>[]).find(
        (x) => String(x.code).toLowerCase() === code,
      );
      if (!c) return null;
      const p = priced.get(code);
      return {
        code,
        title: String(c.title),
        category: (c.category as string | null) ?? null,
        kind: String(c.kind),
        posterUrl: (c.poster_url as string | null) ?? null,
        priceCents: p?.cents ?? 0,
        /* the kill switch in admin means a video can stop being sellable
         * between the share and the reply; then there is simply no button */
        buyHref: p?.active ? `/checkout/${code}/` : null,
      };
    })
    .filter((i): i is ListItem => i !== null);

  const totalCents = items.reduce((s, i) => s + i.priceCents, 0);
  const quotedCents = Number(row.quoted_cents ?? 0);

  return {
    token: String(row.token),
    title: String(row.title),
    note: (row.note as string | null) ?? null,
    ownerName: (row.owner_name as string | null) ?? null,
    items,
    totalCents,
    quotedCents,
    priceChanged: quotedCents > 0 && quotedCents !== totalCents,
    requestedAt: (row.requested_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}
