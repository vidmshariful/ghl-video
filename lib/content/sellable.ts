import { editingPlans, premadePacks, premadeVideos } from "./premade";
import { oldVideos } from "./classic";
import { bundleCategories, collab, videoStack } from "./catalog-extra";
import { codeFor, skuFor } from "./codes";

/* ---------------------------------------------------------------- */
/* The sellable catalog: one derived source of truth                  */
/* ---------------------------------------------------------------- */

/* Every thing sold on-domain, derived from the catalog above so it can
 * never drift. It feeds two consumers: `nativeCheckoutSkus` (which buy
 * buttons route internally) and the products-table sync in /admin (which
 * seeds each row's authoritative price). Add a video or pack to the
 * catalog and it appears here; run "Sync from catalog" in admin and it
 * is live for checkout. `kind` lets the checkout page tailor its copy. */
export type SellableKind = "video" | "pack" | "bundle" | "subscription";

export type SellableProduct = {
  sku: string;
  /* the display code (EXP-014); same string as the sku, upper-cased, for
     one-time products. null only if no code is assigned yet. */
  code: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  type: "one_time" | "subscription";
  kind: SellableKind;
  metadata: Record<string, unknown>;
};

const oneTimeSellables: SellableProduct[] = [
  /* finished, individually-priced new videos (the coming-soon ones ship
     with their pack and become sellable when their preview lands) */
  ...premadeVideos
    .filter((v) => !v.comingSoon && v.preview)
    .map((v): SellableProduct => ({
      sku: skuFor(v.slug),
      code: codeFor(v.slug),
      name: v.title,
      description: v.capability ? `${v.format}. ${v.capability}.` : v.format,
      priceCents: v.price * 100,
      type: "one_time",
      kind: "video",
      metadata: {
        kind: "video",
        code: codeFor(v.slug),
        format: v.format,
        capability: v.capability,
        video_type: v.type,
      },
    })),
  /* the collab pitch versions sold on-domain. Complete Brand Customization
     shares the standalone pitch's sku and is deduped below (first wins),
     so it never produces a second products row. */
  ...collab.projects.flatMap((proj) =>
    proj.versions
      .filter((v) => v.cta === "buy" && v.checkoutSlug)
      .map((v): SellableProduct => ({
        sku: skuFor(v.checkoutSlug!),
        code: codeFor(v.checkoutSlug!),
        name: `${proj.name}: ${v.name}`,
        description: v.note,
        priceCents: v.price * 100,
        type: "one_time",
        kind: "video",
        metadata: {
          kind: "video",
          code: codeFor(v.checkoutSlug!),
          format: "Full Platform Pitch",
          video_type: "Explainer",
        },
      })),
  ),
  /* the classic library plus the three feature-animation packs */
  ...oldVideos.map((v): SellableProduct => {
    const isPack = v.type === "Feature Animation";
    return {
      sku: skuFor(v.slug),
      code: codeFor(v.slug),
      name: v.title,
      description: isPack ? (v.subtitle ?? null) : null,
      priceCents: v.price * 100,
      type: "one_time",
      kind: isPack ? "pack" : "video",
      metadata: isPack
        ? { kind: "pack", code: codeFor(v.slug), format: v.type, video_count: v.packCount ?? null }
        : { kind: "video", code: codeFor(v.slug), format: v.type },
    };
  }),
  /* premade packs (AI First SaaS Pack and any future pack) */
  ...premadePacks.map((p): SellableProduct => ({
    sku: skuFor(p.slug),
    code: codeFor(p.slug),
    name: p.name,
    description: p.tagline,
    priceCents: (p.price ?? 0) * 100,
    type: "one_time",
    kind: "pack",
    metadata: { kind: "pack", code: codeFor(p.slug), video_count: p.count ?? null },
  })),
  /* the Complete Video Stack */
  {
    sku: skuFor(videoStack.sku),
    code: codeFor(videoStack.sku),
    name: videoStack.name,
    description: videoStack.tagline,
    priceCents: videoStack.price * 100,
    type: "one_time",
    kind: "pack",
    metadata: {
      kind: "pack",
      code: codeFor(videoStack.sku),
      video_count: videoStack.totalCount,
      delivery_days: videoStack.deliveryDays,
    },
  },
  /* the eight video bundles (New / Classic / Mix tiers) */
  ...bundleCategories.flatMap((c) =>
    c.tiers.map((t): SellableProduct => ({
      sku: skuFor(t.slug),
      code: codeFor(t.slug),
      name: `${c.name}: ${t.name}`,
      description: t.items.map((i) => i.label).join(", "),
      priceCents: t.price * 100,
      type: "one_time",
      kind: "bundle",
      metadata: {
        kind: "bundle",
        code: codeFor(t.slug),
        category: c.slug,
        delivery_days: t.deliveryDays,
      },
    })),
  ),
];

/* Subscriptions keep their own sku (tied to a Stripe price id) so the
 * catalog sync never re-keys them; they still carry a display code. */
const subscriptionSellables: SellableProduct[] = editingPlans.map(
  (p): SellableProduct => ({
    sku: p.sku,
    code: codeFor(p.sku),
    name: `Editing: ${p.name}`,
    description: null,
    priceCents: p.price * 100,
    type: "subscription",
    kind: "subscription",
    metadata: {
      kind: "subscription",
      code: codeFor(p.sku),
      long_form: p.longForm,
      short_form: p.shortForm,
      featured: p.featured,
    },
  }),
);

/* Dedupe by sku (first wins), so a slug shared across the catalog can
 * never produce two conflicting products rows. */
export const sellableProducts: SellableProduct[] = [
  ...oneTimeSellables,
  ...subscriptionSellables,
].reduce<SellableProduct[]>((acc, p) => {
  if (!acc.some((x) => x.sku === p.sku)) acc.push(p);
  return acc;
}, []);

/* One-time products the catalog sync should create/manage (subscriptions
 * are seeded once, by hand, with their Stripe price id). */
export const oneTimeSellableProducts: SellableProduct[] = sellableProducts.filter(
  (p) => p.type === "one_time",
);

/* Build-time integrity gate: every sellable product must resolve to a product
 * code. A null code means its slug is orphaned (e.g. a pack-video title was
 * edited, breaking the slugify()-derived key), which would 404 its checkout and
 * drop the code from every card. Throwing here fails `next build` with a clear
 * message instead of silently shipping a dead buy button. This validates at
 * build; the same data at runtime has already passed, so it never throws live. */
for (const p of sellableProducts) {
  if (!p.code) {
    throw new Error(
      `[catalog] "${p.name}" (sku "${p.sku}") has no product code: its slug is not in productCodes. ` +
        `Add a productCodes entry or fix the slug so /checkout/${p.sku} resolves.`,
    );
  }
}

/* Which skus the on-domain checkout serves. Derived, so it always matches
 * the catalog and the seeded products. */
export const nativeCheckoutSkus = new Set<string>(
  sellableProducts.map((p) => p.sku),
);
