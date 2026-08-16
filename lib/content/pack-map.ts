import { premadePacks, premadeVideos } from "./premade";
import { oldVideos } from "./classic";
import { bundleCategories, videoStack } from "./catalog-extra";
import { codeFor, skuFor } from "./codes";
import { salesBundles, bundlePickPools, PICK_LABEL, type BundlePickKey } from "@/lib/bundles";

/*
 * The pack map: which videos each pack or bundle contains, and, reversed,
 * which packs a given video belongs to. Derived entirely from the same
 * content modules the site sells from (premade packs, the stack, the video
 * bundles, the sales-LP bundles), so the admin's Products & Packs screens
 * can show composition without a second source of truth to drift.
 *
 * Everything is keyed by SKU (the lowercased product code, e.g. "pack-001"),
 * which is also what the catalog table and products table key by.
 */

export type PackRef = { sku: string; name: string };

export type PackVideoLine = {
  sku: string | null; // null when a member has no individual checkout
  title: string;
  comingSoon: boolean;
};

export type PackContents = {
  name: string;
  /* fixed member videos when the pack is an explicit list */
  videos: PackVideoLine[];
  /* item lines when the pack is count-based ("2x Explainer", ...) */
  lines: string[];
  videoCount: number | null;
  deliveryDays: number | null;
  note: string | null;
};

/* ---------------------------------------------------------------- */
/* Contents per pack / bundle sku                                    */
/* ---------------------------------------------------------------- */

const contents = new Map<string, PackContents>();

/* Premade packs (AI First SaaS Pack): explicit video lists. Members are
 * matched back to premadeVideos by title, the same identity premade.ts
 * dedupes by, so slugs and codes stay authoritative. */
const bySlugTitle = new Map(premadeVideos.map((v) => [v.title, v]));
for (const pack of premadePacks) {
  const members = pack.categories.flatMap((c) => c.videos);
  contents.set(skuFor(pack.slug), {
    name: pack.name,
    videos: members.map((m) => {
      const v = bySlugTitle.get(m.title);
      return {
        // no code yet (e.g. coming soon) means no individual checkout
        sku: v && codeFor(v.slug) ? skuFor(v.slug) : null,
        title: m.title,
        comingSoon: (v?.comingSoon ?? m.comingSoon) || false,
      };
    }),
    lines: pack.categories.map((c) => `${c.count ?? c.videos.length}x ${c.name}`),
    videoCount: pack.count,
    deliveryDays: null,
    note: null,
  });
}

/* The Complete Video Stack: count-based across every format. */
contents.set(skuFor(videoStack.sku), {
  name: videoStack.name,
  videos: [],
  lines: videoStack.formats.map((f) => `${f.count}x ${f.name}`),
  videoCount: videoStack.totalCount,
  deliveryDays: videoStack.deliveryDays,
  note: "Mixes the new releases with the classic library. Composition follows the site catalog.",
});

/* Classic feature-animation packs: self-contained sets of N animations. */
for (const v of oldVideos) {
  if (v.type !== "Feature Animation") continue;
  contents.set(skuFor(v.slug), {
    name: v.title,
    videos: [],
    lines: [],
    videoCount: v.packCount ?? null,
    deliveryDays: null,
    note: v.subtitle ?? "A set of feature animations delivered together.",
  });
}

/* The eight video bundles (New / Classic / Mix tiers): count-based. */
for (const cat of bundleCategories) {
  for (const t of cat.tiers) {
    contents.set(skuFor(t.slug), {
      name: `${cat.name}: ${t.name}`,
      videos: [],
      lines: t.items.map((i) => `${i.label} (${i.library})`),
      videoCount: null,
      deliveryDays: t.deliveryDays,
      note: "The buyer picks the videos after checkout.",
    });
  }
}

/* The sales-LP bundles (lp-*): Essential and Growth pick at intake from the
 * LP pools; Ultimate is every pool video. Their skus are literal (not coded). */
const pools = bundlePickPools();
for (const b of salesBundles) {
  const allPoolVideos = (Object.keys(pools) as BundlePickKey[]).flatMap((k) =>
    pools[k].map((v) => ({
      sku: codeFor(v.slug) ? skuFor(v.slug) : null,
      title: v.title,
      comingSoon: v.comingSoon,
    })),
  );
  contents.set(b.sku, {
    name: `Sales LP bundle: ${b.name}`,
    videos: b.pickAtIntake ? [] : allPoolVideos,
    lines: b.items.slice(),
    videoCount: b.videoCount,
    deliveryDays: b.deliveryDays,
    note: b.pickAtIntake
      ? `The buyer picks ${b.videoCount} videos at intake${b.pick ? ` (${(Object.keys(b.pick) as BundlePickKey[]).filter((k) => b.pick![k] > 0).map((k) => `${b.pick![k]} ${PICK_LABEL[k]}`).join(", ")})` : ""}.`
      : "Includes every video in the LP library.",
  });
}

/** Composition for a pack/bundle sku, or null when it is not one we map. */
export const packContentsFor = (sku: string): PackContents | null =>
  contents.get(sku) ?? null;

/* ---------------------------------------------------------------- */
/* Reverse index: which packs contain / can pick a given video        */
/* ---------------------------------------------------------------- */

const inPacks = new Map<string, PackRef[]>();
const pickableIn = new Map<string, PackRef[]>();

function push(map: Map<string, PackRef[]>, videoSku: string | null, ref: PackRef) {
  if (!videoSku) return;
  const list = map.get(videoSku) ?? [];
  if (!list.some((r) => r.sku === ref.sku)) list.push(ref);
  map.set(videoSku, list);
}

/* fixed membership: explicit pack lists (premade packs, LP Ultimate) */
for (const [sku, c] of contents) {
  for (const v of c.videos) push(inPacks, v.sku, { sku, name: c.name });
}

/* fixed membership: the stack contains every premade and classic video */
const stackRef: PackRef = { sku: skuFor(videoStack.sku), name: videoStack.name };
for (const v of premadeVideos) push(inPacks, codeFor(v.slug) ? skuFor(v.slug) : null, stackRef);
for (const v of oldVideos) {
  if (v.type === "Feature Animation") continue; // FA packs are peers, not members
  push(inPacks, codeFor(v.slug) ? skuFor(v.slug) : null, stackRef);
}

/* pick eligibility: the LP bundles that choose from the pools at intake */
for (const b of salesBundles) {
  if (!b.pickAtIntake || !b.pick) continue;
  for (const key of Object.keys(pools) as BundlePickKey[]) {
    if ((b.pick[key] ?? 0) === 0) continue;
    for (const v of pools[key]) {
      push(pickableIn, codeFor(v.slug) ? skuFor(v.slug) : null, {
        sku: b.sku,
        name: `Sales LP bundle: ${b.name}`,
      });
    }
  }
}

/** Packs that include this video outright (by video sku / catalog code). */
export const packsContaining = (videoSku: string): PackRef[] =>
  inPacks.get(videoSku.toLowerCase()) ?? [];

/** Bundles where the buyer can pick this video at intake. */
export const packsPickable = (videoSku: string): PackRef[] =>
  pickableIn.get(videoSku.toLowerCase()) ?? [];
