import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * The video library, as the portal sees it.
 *
 * Two sources on purpose. The catalogue supplies what a video IS: its title,
 * category, poster and preview. The products table supplies what it COSTS,
 * because that is the row checkout charges against. Showing a price from
 * anywhere else risks quoting a number the card is not charged, which is the
 * exact fault the daily price check exists to catch. Better not to create it
 * here in the first place.
 *
 * `active` on the product is the buy button kill switch, so anything switched
 * off in admin simply does not appear rather than appearing and failing at
 * checkout.
 *
 * Signing in is optional. Browsing is open, because somebody deciding whether
 * to buy should not have to make an account to look. What signing in adds is
 * knowing what they already own.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const db = supabaseAdmin();

  const [{ data: catalog }, { data: products }, { data: packItems }, { data: bundleRules }] =
    await Promise.all([
      /* The whole catalogue, not just the sellable part. A pack's members are
       * needed for its cover art even when a member is not itself on sale. */
      db
        .from("catalog")
        .select(
          "code, title, subject, category, kind, poster_url, video_url, featured, sort, on_site, coming_soon, pack_count",
        )
        .order("sort"),
      db.from("products").select("sku, price_cents, active, name"),
      db.from("catalog_pack_items").select("pack_code, item_code, sort").order("sort"),
      db.from("catalog_bundle_rules").select("bundle_code, label, category, count, sort").order("sort"),
    ]);

  const priced = new Map(
    ((products ?? []) as Row[])
      .filter((p) => p.active)
      .map((p) => [String(p.sku), { cents: Number(p.price_cents), name: String(p.name) }]),
  );

  const posterOf = new Map(
    ((catalog ?? []) as Row[]).map((c) => [String(c.code), (c.poster_url as string | null) ?? null]),
  );

  /*
   * What is inside a pack or a bundle, for the card to show.
   *
   * These are the most expensive things we sell and they were the emptiest
   * things on the screen, because a bundle has no footage of its own. So the
   * cover is built from what it contains: the member stills where we know
   * them, and always the number of videos, which is the whole argument for
   * buying one. Seventy nine videos for $1,595 is a case the card should be
   * making by itself.
   */
  const membersOf = new Map<string, string[]>();
  for (const i of (packItems ?? []) as Row[]) {
    const k = String(i.pack_code);
    membersOf.set(k, [...(membersOf.get(k) ?? []), String(i.item_code)]);
  }

  /** Slots a bundle promises, merged by category: the rules list repeats some. */
  const slotsOf = new Map<string, { label: string; count: number }[]>();
  for (const r of (bundleRules ?? []) as Row[]) {
    const k = String(r.bundle_code);
    const label = String(r.category ?? r.label ?? "Video");
    const list = slotsOf.get(k) ?? [];
    const hit = list.find((s) => s.label === label);
    if (hit) hit.count += Number(r.count);
    else list.push({ label, count: Number(r.count) });
    slotsOf.set(k, list);
  }

  /** How many videos this code is worth, and what its cover should show. */
  function contentsOf(c: Row) {
    const code = String(c.code);
    const kind = String(c.kind);
    if (kind === "video") return { videoCount: null, covers: [] as string[], contains: null };

    const members = membersOf.get(code) ?? [];
    if (members.length) {
      return {
        videoCount: members.length,
        covers: members.map((m) => posterOf.get(m)).filter((p): p is string => Boolean(p)).slice(0, 4),
        contains: null,
      };
    }

    const slots = slotsOf.get(code) ?? [];
    if (slots.length) {
      return {
        videoCount: slots.reduce((s, x) => s + x.count, 0),
        covers: [],
        /* the three biggest groups, which is what somebody skims for */
        contains: [...slots]
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((s) => `${s.count} ${s.label}`)
          .join(", "),
      };
    }

    /* sold as a set of N with no itemised contents: the animation packs */
    const n = Number(c.pack_count ?? 0);
    return { videoCount: n || null, covers: [], contains: null };
  }

  /*
   * What this account already owns, so the library can say so. Anything they
   * bought is marked and sorted to the end rather than hidden: the collection
   * should still read as complete, and somebody who owns nine of a pack's
   * twelve wants to see the three they are missing next to the nine they
   * have, not on their own.
   */
  let owned = new Set<string>();
  const ctx = await resolvePortalContext(db, req, "customer");
  const signedIn = !("failStatus" in ctx);
  if (signedIn) {
    const { data: orders } = await db
      .from("orders")
      .select("id")
      .eq("customer_email", ctx.ownerEmail)
      .eq("status", "paid");
    const ids = (orders ?? []).map((o) => o.id as string);
    if (ids.length) {
      const { data: mine } = await db
        .from("order_deliverables")
        .select("catalog_code")
        .in("order_id", ids)
        .not("catalog_code", "is", null);
      owned = new Set((mine ?? []).map((d) => String(d.catalog_code)));
    }
  }

  /*
   * A collection's members, in full, so the card can OPEN.
   *
   * "12 videos" on the cover was the argument for buying; this is the proof.
   * Members are described from the whole catalogue, not the sellable slice,
   * because a pack can legitimately contain a video that is not sold alone.
   * Owned marks apply per member: somebody who owns three of a pack's nine
   * should see exactly which three when they look inside.
   */
  const byCode = new Map(((catalog ?? []) as Row[]).map((c) => [String(c.code), c]));
  function membersDetail(code: string) {
    const members = membersOf.get(code) ?? [];
    if (!members.length) return null;
    return members.map((m) => {
      const c = byCode.get(m);
      return {
        code: m,
        title: c ? String(c.title) : m.toUpperCase(),
        category: (c?.category as string | null) ?? null,
        posterUrl: (c?.poster_url as string | null) ?? null,
        previewUrl: (c?.video_url as string | null) ?? null,
        owned: owned.has(m),
      };
    });
  }

  const items = ((catalog ?? []) as Row[])
    /* the sellable slice, now that the members have been read off the rest */
    .filter((c) => c.on_site && !c.coming_soon)
    .map((c) => {
      const code = String(c.code);
      const p = priced.get(code);
      if (!p) return null; // no active product: not for sale right now
      const { videoCount, covers, contains } = contentsOf(c);
      const kind = String(c.kind);
      return {
        code,
        videoCount,
        covers,
        contains,
        /* what is actually inside, for the detail view */
        members: kind === "video" ? null : membersDetail(code),
        slots: kind === "video" ? null : (slotsOf.get(code) ?? null),
        title: String(c.title),
        subject: (c.subject as string | null) ?? null,
        /* Packs and bundles have no category, and that is correct rather than
         * missing data: a category describes what a single video explains, and
         * a bundle of twelve explains twelve things. Left null so the filter
         * row can leave them out instead of offering "null" as a type. */
        category: (c.category as string | null) ?? null,
        kind: String(c.kind) as "video" | "pack" | "bundle",
        priceCents: p.cents,
        posterUrl: (c.poster_url as string | null) ?? null,
        previewUrl: (c.video_url as string | null) ?? null,
        featured: Boolean(c.featured),
        owned: owned.has(code),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    /* owned last, featured first, then the catalogue's own order */
    .sort((a, b) => Number(a.owned) - Number(b.owned) || Number(b.featured) - Number(a.featured));

  return NextResponse.json({
    items,
    signedIn,
    categories: [...new Set(items.map((i) => i.category))].sort(),
  });
}
