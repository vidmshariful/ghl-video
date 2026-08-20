import {
  cta,
  featureAnimations,
  oldVideoTypes,
  oldVideos,
  premadeVideos,
  videoStack,
} from "@/lib/site";
import type { CatalogRow } from "@/lib/catalog-scheme";

/* a common shape both the new catalog and the classic library browse
 * through: a card, a price, a preview, and a real order link */
export type BrowseVideo = {
  slug: string;
  /* the permanent catalog code (e.g. "fexp-031"); when set it IS both the
     displayed code and the checkout sku. Absent for legacy code-catalog rows,
     which resolve their code + sku from the slug. */
  code?: string | null;
  /* video, pack or bundle; absent on legacy rows, which are all videos */
  kind?: "video" | "pack" | "bundle" | null;
  title: string;
  typeTag: string;
  subTag: string;
  price: number;
  preview: string | null;
  poster: string | null;
  wistiaId: string | null;
  subtitle: string | null;
  packCount: number | null;
  /* feature animations ship in two cuts and aren't sold on their own */
  realPreview: string | null;
  realPoster: string | null;
  previewOnly: boolean;
  /* what a preview-only card says in place of a price + buy button */
  previewNote: string | null;
  previewCtaLabel: string | null;
  /* preview-only cards buy their parent pack: its native checkout sku.
     null for individually-sold videos, which buy by their own slug. */
  checkoutSku: string | null;
};

export type FilterDef = {
  label: string;
  options: readonly string[];
  on: "typeTag" | "subTag";
};

/* feature animations exist in two cuts the buyer toggles between */
export type Version = "simplified" | "real";

export const newReady: BrowseVideo[] = premadeVideos
  .filter((v) => !v.comingSoon && v.preview)
  .map((v) => ({
    slug: v.slug,
    title: v.title,
    typeTag: v.type,
    subTag: v.capability,
    price: v.price,
    preview: v.preview,
    poster: v.poster,
    wistiaId: null,
    subtitle: null,
    packCount: null,
    realPreview: null,
    realPoster: null,
    previewOnly: false,
    previewNote: null,
    previewCtaLabel: null,
    checkoutSku: null,
  }));

export const newGroups: FilterDef[] = [
  { label: "Video type", options: [...new Set(newReady.map((v) => v.typeTag))], on: "typeTag" },
  { label: "Capability", options: [...new Set(newReady.map((v) => v.subTag))], on: "subTag" },
];

/* feature animations get their own playlist tab, so the classic grid is
 * every other pre-2026 type: the individually-buyable videos. */
export const oldClassic: BrowseVideo[] = oldVideos
  .filter((v) => v.type !== "Feature Animation")
  .map((v) => ({
    slug: v.slug,
    title: v.title,
    typeTag: v.type,
    subTag: "Classic",
    price: v.price,
    preview: v.preview ?? null,
    poster: v.poster,
    wistiaId: v.wistiaId ?? null,
    subtitle: v.subtitle ?? null,
    packCount: v.packCount ?? null,
    realPreview: null,
    realPoster: null,
    previewOnly: false,
    previewNote: null,
    previewCtaLabel: null,
    checkoutSku: null,
  }));

export const oldBrowse: BrowseVideo[] = oldClassic;

export const oldGroups: FilterDef[] = [
  {
    label: "Video type",
    options: oldVideoTypes.filter((t) => t !== "Feature Animation"),
    on: "typeTag",
  },
];

/* the three feature-animation bundles: this is how they are sold, in
 * multiples, never one at a time. */
export const featurePacks = oldVideos.filter((v) => v.type === "Feature Animation");

/* the 23 feature animations, each a two-cut preview (Simplified / Real
 * UI). Bundled in the packs, so no single price or checkout. */
export const featureBrowse: BrowseVideo[] = featureAnimations.map((f) => ({
  slug: `fa-${f.slug}`,
  title: f.name,
  typeTag: "Feature Animation",
  subTag: "Classic",
  price: 0,
  preview: f.simplified,
  poster: f.thumbSimplified,
  wistiaId: null,
  subtitle: f.real ? "Simplified and Real UI" : "Simplified UI",
  packCount: null,
  realPreview: f.real,
  realPoster: f.thumbReal,
  previewOnly: true,
  previewNote: "Included in every feature-animation pack, branded to you.",
  previewCtaLabel: "See the packs",
  checkoutSku: "feature-animations-15",
}));

/* the Complete Video Stack's pre-decided line-up: our HighLevel team's
 * pick of the strongest videos across the new and classic library, in
 * the exact counts the stack sells (2 / 1 / 20 / 15 / 15 = 53). Swappable
 * on request at checkout. Built here so the counts can never drift. */
export const stackNote =
  "Hand-picked by our HighLevel team from the full library, updated for every reseller. Want a different video in any slot? Request swaps at checkout.";

export const stackByType = (type: string) =>
  oldClassic.filter((v) => v.typeTag === type);

export const stackPicks: BrowseVideo[] = [
  ...stackByType("Explainer").slice(0, 2),
  ...stackByType("Demo").filter((v) => v.slug === "ai-platform-demo"),
  ...stackByType("Short Explainer").slice(0, 20),
  ...stackByType("Marketing").slice(0, 15),
  ...featureBrowse.slice(0, 15),
].map((v) => ({
  ...v,
  price: 0,
  previewOnly: true,
  previewNote: "Part of the Complete Video Stack, branded to your platform.",
  previewCtaLabel: cta.orderPremade,
  checkoutSku: videoStack.sku,
}));

export const stackGroups: FilterDef[] = [
  {
    label: "Format",
    options: [...new Set(stackPicks.map((v) => v.typeTag))],
    on: "typeTag",
  },
];

/* ---------------------------------------------------------------- */
/* DB catalog -> browse cards                                         */
/* ---------------------------------------------------------------- */

/* one admin-managed catalog row -> a library card. slug + code are the
 * catalog code, so the card shows it and buys by it directly. */
export function catalogToBrowse(r: CatalogRow): BrowseVideo {
  return {
    slug: r.code,
    code: r.code,
    kind: r.kind ?? "video",
    title: r.title,
    /* collections mostly carry no category of their own; the kind is the
       honest tag, and it keeps the category rail free of a nameless row */
    typeTag: r.category ?? (r.kind === "bundle" ? "Bundle" : r.kind === "pack" ? "Pack" : "Video"),
    subTag: r.library === "new" ? "New" : "Classic",
    price: r.price_cents / 100,
    preview: r.video_url,
    poster: r.poster_url,
    wistiaId: r.wistia_id,
    subtitle: r.subject,
    packCount: r.pack_count,
    realPreview: null,
    realPoster: null,
    previewOnly: false,
    previewNote: null,
    previewCtaLabel: null,
    checkoutSku: null,
  };
}

const CATEGORY_ORDER = [
  "Full Explainer",
  "Feature Explainer",
  "Demo",
  "Marketing",
  "Feature Animation",
];

/* grid-worthy: something to show (clip, wistia poster, or a pack tile) and
 * not still in production. Packs and bundles are always showable: they have
 * no footage of their own, and the tile that stands in for one is built from
 * what it contains. */
const showable = (r: CatalogRow) =>
  !r.coming_soon &&
  Boolean(
    r.video_url || r.pack_count || r.wistia_id || r.kind === "pack" || r.kind === "bundle",
  );

/* Full Library: new first, then classics; each in catalog order */
export function libraryBrowse(rows: CatalogRow[]): BrowseVideo[] {
  return [...rows]
    .filter(showable)
    .sort(
      (a, b) =>
        (a.library === "new" ? 0 : 1) - (b.library === "new" ? 0 : 1) ||
        a.sort - b.sort,
    )
    .map(catalogToBrowse);
}

/* Featured tab: the rows the admin flagged */
export function featuredBrowse(rows: CatalogRow[]): BrowseVideo[] {
  return rows.filter((r) => r.featured && showable(r)).map(catalogToBrowse);
}

/* Recent Launch tab: a rolling window by release date, newest first */
export function recentBrowse(rows: CatalogRow[], cutoff: string): BrowseVideo[] {
  return rows
    .filter((r) => showable(r) && r.release_date != null && r.release_date >= cutoff)
    .sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
    .map(catalogToBrowse);
}

/* the Full Library sidebar: filter by video type, then by new vs classic */
export function libraryGroups(videos: BrowseVideo[]): FilterDef[] {
  return [
    {
      label: "Video type",
      options: CATEGORY_ORDER.filter((t) => videos.some((v) => v.typeTag === t)),
      on: "typeTag",
    },
    {
      label: "Library",
      options: ["New", "Classic"].filter((l) => videos.some((v) => v.subTag === l)),
      on: "subTag",
    },
  ];
}

/*
 * The premade library: the home for every video and pack. The view
 * rail lists the curated tabs (Featured, Recent Launch) plus the two
 * packs and the full filterable library. Every video is individually
 * purchasable and also bundled in a pack, so single-buy and pack-buy
 * live side by side. Square corners throughout: this is the page's
 * grid-lined instrument panel.
 */
