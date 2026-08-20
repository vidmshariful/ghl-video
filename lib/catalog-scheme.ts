/*
 * The catalog SKU scheme, in one place so the DB seed (scripts/seed-catalog.ts)
 * and the live render's fallback (lib/catalog-db.ts) can never drift.
 *
 * Pure + code-derived: turns the code catalog (premadeVideos + oldVideos) into
 * catalog rows with the approved scheme. EXP = full-platform explainers, FEXP =
 * every feature explainer (was SHORT + the 4 classic feature-level "Explainer"
 * videos), DEMO, MKT, FA. CLASSIC videos number first within each prefix, then
 * the new ones. old_code = each video's current checkout sku (kept for redirects).
 */
import { premadeVideos, oldVideos, skuFor } from "@/lib/site";

export type CatalogCategory =
  | "Full Explainer"
  | "Feature Explainer"
  | "Demo"
  | "Marketing"
  | "Feature Animation";

export type CatalogRow = {
  code: string;
  old_code: string | null;
  title: string;
  subject: string | null;
  category: CatalogCategory;
  /* what shape of product this is; drives the Type filter on the library */
  kind?: "video" | "pack" | "bundle" | null;
  library: "new" | "classic";
  price_cents: number;
  video_url: string | null;
  poster_url: string | null;
  wistia_id: string | null;
  pack_count: number | null;
  featured: boolean;
  release_date: string | null;
  on_site: boolean;
  coming_soon: boolean;
  sort: number;
};

/* a widened view over the two source shapes (PremadeVideo | OldVideo) so we can
 * read every field they might carry without `any` */
type SourceVideo = {
  slug: string;
  title: string;
  type: string;
  price?: number;
  preview?: string | null;
  poster?: string | null;
  format?: string;
  capability?: string;
  subtitle?: string;
  wistiaId?: string;
  packCount?: number;
  comingSoon?: boolean;
};

const FULL_EXPLAINER_FORMATS = new Set(["Master Explainer", "Full Platform Pitch"]);
const FULL_EXPLAINER_CLASSIC = new Set([
  "all-in-one-platform-explainer",
  "complete-platform-tour-explainer",
]);

const catForNew = (v: SourceVideo): CatalogCategory => {
  if (v.type === "Demo") return "Demo";
  if (v.type === "Explainer")
    return FULL_EXPLAINER_FORMATS.has(v.format ?? "") ? "Full Explainer" : "Feature Explainer";
  return "Feature Explainer";
};

const catForOld = (v: SourceVideo): CatalogCategory => {
  if (v.type === "Feature Animation") return "Feature Animation";
  if (v.type === "Marketing") return "Marketing";
  if (v.type === "Demo") return "Demo";
  if (v.type === "Explainer")
    return FULL_EXPLAINER_CLASSIC.has(v.slug) ? "Full Explainer" : "Feature Explainer";
  return "Feature Explainer"; // Short Explainer
};

/* release dates for the NEW videos (drive the Recent Launch window); classics
 * stay null */
const RELEASE: Record<string, string> = {
  "highlevel-official-full-platform-pitch": "2026-07-05",
  "all-in-one-ai-first-positioning": "2026-07-10",
  "ai-receptionist-conversational-ai": "2026-07-10",
  "unified-inbox-conversational-ai": "2026-07-15",
  "reputation-management-reviews-ai": "2026-07-18",
  "social-media-planner-content-ai": "2026-07-24",
  "ai-website-funnel-builder": "2026-08-05",
  "lead-to-close-with-ai": "2026-08-05",
  "ask-ai-your-in-platform-assistant": "2026-08-07",
  "mobile-app-run-your-business-from-your-phone": "2026-08-09",
};

/* the starter Featured set (the admin adjusts featured per row afterward) */
const FEATURED = new Set([
  "all-in-one-ai-first-positioning",
  "highlevel-official-full-platform-pitch",
  "ai-receptionist-conversational-ai",
  "social-media-planner-content-ai",
  "ai-website-funnel-builder",
  "ai-platform-demo",
]);

const PREFIX: Record<CatalogCategory, string> = {
  "Full Explainer": "exp",
  "Feature Explainer": "fexp",
  Demo: "demo",
  Marketing: "mkt",
  "Feature Animation": "fa",
};

/* classic first, then new, so classics take the low numbers within each prefix */
export function buildCatalogRows(): CatalogRow[] {
  const items = [
    ...(oldVideos as unknown as SourceVideo[]).map((v) => ({
      v,
      library: "classic" as const,
      category: catForOld(v),
    })),
    ...(premadeVideos as unknown as SourceVideo[]).map((v) => ({
      v,
      library: "new" as const,
      category: catForNew(v),
    })),
  ];

  const counters: Record<string, number> = {};
  return items.map((it, idx) => {
    const v = it.v;
    const prefix = PREFIX[it.category];
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const code = `${prefix}-${String(counters[prefix]).padStart(3, "0")}`;
    return {
      code,
      old_code: skuFor(v.slug),
      title: v.title,
      subject: v.capability ?? v.subtitle ?? null,
      category: it.category,
      library: it.library,
      price_cents: Math.round((v.price ?? 0) * 100),
      video_url: v.preview ?? null,
      poster_url: v.poster ?? null,
      wistia_id: v.wistiaId ?? null,
      pack_count: v.packCount ?? null,
      featured: FEATURED.has(v.slug),
      release_date: it.library === "new" ? (RELEASE[v.slug] ?? null) : null,
      on_site: true,
      coming_soon: v.comingSoon ?? false,
      sort: idx,
    };
  });
}
