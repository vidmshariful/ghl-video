import { premadeVideos } from "@/lib/content/premade";

/*
 * The bundle order-domain: the sales-LP bundle tiers (lp-*) and the intake
 * video-picker logic.
 *
 * Kept SEPARATE from lib/sales/pages.ts (which is only landing-page content)
 * because this is imported by three of the four parts: the money path (checkout
 * intake + its API route), the backend (admin order screen), and the sales
 * pages. Editing landing-page copy should not touch the code checkout validates
 * against. This module is client-safe (pure data + pure functions, no
 * server-only), so the checkout/admin client components can import it.
 *
 * The bundles are three fixed tiers priced against the a-la-carte value of the
 * LP videos (Master/Feature $495, Demo $995). Essential and Growth let the
 * buyer pick videos at intake; Ultimate is every video. The products live in
 * the DB (skus below) and are checked against this file by scripts/check-drift.ts.
 */
export type SalesBundle = {
  sku: string;
  name: string;
  price: number;
  anchorPrice: number;
  deliveryDays: number;
  videoCount: number;
  items: string[];
  pickAtIntake: boolean;
  featured?: boolean;
  badge?: string; // label for the featured badge (defaults to "Most popular")
  /* how many to choose per category at intake (pickAtIntake bundles only) */
  pick?: { master: number; demo: number; feature: number };
};

export const salesBundles: SalesBundle[] = [
  {
    sku: "lp-essential",
    name: "Essential",
    price: 995,
    anchorPrice: 1485,
    deliveryDays: 7,
    videoCount: 3,
    items: ["1x Full Explainer", "2x Feature Explainer"],
    pickAtIntake: true,
    pick: { master: 1, demo: 0, feature: 2 },
  },
  {
    sku: "lp-growth",
    name: "Growth",
    price: 1795,
    anchorPrice: 3965,
    deliveryDays: 10,
    videoCount: 7,
    items: ["2x Full Explainer", "1x Demo", "4x Feature Explainer"],
    pickAtIntake: true,
    pick: { master: 2, demo: 1, feature: 4 },
  },
  {
    sku: "lp-ultimate",
    name: "Ultimate",
    price: 2295,
    anchorPrice: 6940,
    deliveryDays: 14,
    videoCount: 12,
    featured: true,
    badge: "Best value",
    items: ["All 3x Full Explainer", "Both Demo Videos", "All 7x Feature Explainer"],
    pickAtIntake: false,
  },
];

export const salesBundleBySku = (sku: string): SalesBundle | undefined =>
  salesBundles.find((b) => b.sku === sku);

/* ---------------------------------------------------------------- */
/* Bundle video picker (Essential/Growth intake selection)           */
/* ---------------------------------------------------------------- */

/* The three pick categories map to the LP library's video types. A pickable
 * video is identified by its stable slug (the code catalog has legacy drift
 * for some AI-pack videos, so slug is the safe identity); title/format are for
 * display. */
export type BundlePickKey = "master" | "demo" | "feature";
export type BundlePickVideo = {
  slug: string;
  title: string;
  format: string;
  comingSoon: boolean;
};

const PICK_TYPE: Record<BundlePickKey, string> = {
  master: "Explainer",
  demo: "Demo",
  feature: "Feature Explainer",
};

export const PICK_LABEL: Record<BundlePickKey, string> = {
  master: "Full Explainer",
  demo: "Demo",
  feature: "Feature Explainer",
};

/* The classic (Wistia) videos the LP surfaces alongside the new library
 * (kept in sync with EXTRA_VIDEOS in the LP page). Appended to the pools so
 * the picker offers exactly what the page advertises. */
const CLASSIC_PICKS: Record<BundlePickKey, BundlePickVideo[]> = {
  master: [
    { slug: "complete-platform-tour-explainer", title: "Complete Platform Tour Explainer", format: "Full platform tour", comingSoon: false },
  ],
  demo: [
    { slug: "ai-platform-demo", title: "Overall Platform Walkthrough", format: "Platform demo", comingSoon: false },
  ],
  feature: [],
};

/* The pickable videos per category, derived from the same catalog the LP
 * renders so the intake picker never drifts from the page. In-production
 * videos are included (marked) so a bundle with N slots always offers a real
 * choice; they deliver with the bundle when they release. */
export function bundlePickPools(): Record<BundlePickKey, BundlePickVideo[]> {
  const fromCatalog = (key: BundlePickKey): BundlePickVideo[] =>
    premadeVideos
      .filter((v) => v.type === PICK_TYPE[key])
      .map((v) => ({
        slug: v.slug,
        title: v.title,
        format: v.format,
        comingSoon: v.comingSoon,
      }));
  return {
    master: [...fromCatalog("master"), ...CLASSIC_PICKS.master],
    demo: [...fromCatalog("demo"), ...CLASSIC_PICKS.demo],
    feature: [...fromCatalog("feature"), ...CLASSIC_PICKS.feature],
  };
}

/** slug -> title, across every pool, for read-back in admin. */
export function bundlePickTitles(): Record<string, string> {
  const m: Record<string, string> = {};
  const pools = bundlePickPools();
  for (const arr of Object.values(pools)) for (const v of arr) m[v.slug] = v.title;
  return m;
}

export type BundleSelections = Record<BundlePickKey, string[]>;

/* Server-truth validation of a client-submitted selection: exact counts per
 * category, and every slug must belong to that category's pool. Bundles that
 * do not pick at intake (Ultimate, or non-bundles) pass with no selection. */
export function validateBundleSelections(
  sku: string,
  selections: Partial<Record<string, unknown>> | null | undefined,
): { ok: boolean; error?: string; clean?: BundleSelections } {
  const bundle = salesBundleBySku(sku);
  if (!bundle || !bundle.pickAtIntake || !bundle.pick) return { ok: true };
  if (!selections || typeof selections !== "object") {
    return { ok: false, error: "Please choose your videos before submitting." };
  }
  const pools = bundlePickPools();
  const clean: BundleSelections = { master: [], demo: [], feature: [] };
  for (const key of ["master", "demo", "feature"] as BundlePickKey[]) {
    const need = bundle.pick[key] ?? 0;
    const raw = selections[key];
    const picked = Array.isArray(raw) ? raw : [];
    const valid = new Set(pools[key].map((v) => v.slug));
    const uniq = [...new Set(picked.map((c) => String(c)))].filter((c) => valid.has(c));
    if (uniq.length !== need) {
      return {
        ok: false,
        error: `Please pick exactly ${need} ${PICK_LABEL[key]} video${need === 1 ? "" : "s"}.`,
      };
    }
    clean[key] = uniq;
  }
  return { ok: true, clean };
}

/* ---------------------------------------------------------------- */
/* Build-time integrity gate for the sales bundles                   */
/* ---------------------------------------------------------------- */
/* Runs at module eval (the LP page imports salesBundles), so a bad edit
 * fails `next build` with a clear message instead of shipping a broken
 * offer. Catches the exact mistakes that are easy to make by hand: an
 * anchor that is not above the price, pick counts that do not add up to
 * the advertised video count, and a pick that asks for more videos than
 * the catalog can supply. It cannot check the DB price (that is the
 * scripts/check-drift.ts job); this is pure code-consistency. */
{
  const pools = bundlePickPools();
  for (const b of salesBundles) {
    if (b.anchorPrice <= b.price) {
      throw new Error(
        `[salesBundles] "${b.sku}": anchorPrice (${b.anchorPrice}) must be greater than price (${b.price}).`,
      );
    }
    if (b.pickAtIntake) {
      if (!b.pick) {
        throw new Error(`[salesBundles] "${b.sku}": pickAtIntake is true but pick counts are missing.`);
      }
      const sum = b.pick.master + b.pick.demo + b.pick.feature;
      if (sum !== b.videoCount) {
        throw new Error(
          `[salesBundles] "${b.sku}": pick counts add to ${sum} but videoCount is ${b.videoCount}. Keep them in sync.`,
        );
      }
      for (const key of ["master", "demo", "feature"] as BundlePickKey[]) {
        const need = b.pick[key] ?? 0;
        if (need > pools[key].length) {
          throw new Error(
            `[salesBundles] "${b.sku}": asks for ${need} ${key} videos but the catalog only offers ${pools[key].length}.`,
          );
        }
      }
    }
  }
}
