/*
 * Seed the `catalog` table from the code catalog with the NEW sku scheme.
 * Derived from lib/content so the 60+ video URLs are never hand-copied.
 *
 * Scheme: EXP (full-platform explainers), FEXP (feature explainers, was
 * SHORT + the classic feature-level "Explainer" videos), DEMO, MKT, FA.
 * Within each prefix, CLASSIC videos number first (01...), then NEW ones.
 * old_code = each video's current checkout sku, kept for redirects.
 *
 * Run: node_modules/.bin/tsx scripts/seed-catalog.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { premadeVideos, oldVideos, skuFor } from "../lib/site";

const dot: Record<string, string> = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    dot[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const env = (k: string) => dot[k] ?? process.env[k];
const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);

const FULL_EXPLAINER_FORMATS = new Set(["Master Explainer", "Full Platform Pitch"]);
const FULL_EXPLAINER_CLASSIC = new Set(["all-in-one-platform-explainer", "complete-platform-tour-explainer"]);

const catForNew = (v: any): string => {
  if (v.type === "Demo") return "Demo";
  if (v.type === "Explainer") return FULL_EXPLAINER_FORMATS.has(v.format) ? "Full Explainer" : "Feature Explainer";
  return "Feature Explainer"; // Feature Explainer
};
const catForOld = (v: any): string => {
  if (v.type === "Feature Animation") return "Feature Animation";
  if (v.type === "Marketing") return "Marketing";
  if (v.type === "Demo") return "Demo";
  if (v.type === "Explainer") return FULL_EXPLAINER_CLASSIC.has(v.slug) ? "Full Explainer" : "Feature Explainer";
  return "Feature Explainer"; // Short Explainer
};

/* recent-launch dates for the NEW videos; classics stay null */
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

/* a strong starter set for the Featured tab (owner adjusts later) */
const FEATURED = new Set([
  "all-in-one-ai-first-positioning",
  "highlevel-official-full-platform-pitch",
  "ai-receptionist-conversational-ai",
  "social-media-planner-content-ai",
  "ai-website-funnel-builder",
  "ai-platform-demo",
]);

const PREFIX: Record<string, string> = {
  "Full Explainer": "exp",
  "Feature Explainer": "fexp",
  Demo: "demo",
  Marketing: "mkt",
  "Feature Animation": "fa",
};

// classic first, then new -> classics get the low numbers
const items = [
  ...oldVideos.map((v: any) => ({ v, library: "classic", category: catForOld(v) })),
  ...premadeVideos.map((v: any) => ({ v, library: "new", category: catForNew(v) })),
];

const counters: Record<string, number> = {};
const rows = items.map((it, idx) => {
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
    notes: null,
  };
});

async function main() {
  // clean re-seed (Phase 1 table, only this script writes it)
  await sb.from("catalog").delete().not("id", "is", null);
  const { error } = await sb.from("catalog").insert(rows);
  if (error) {
    console.error("insert failed:", error.message);
    process.exit(1);
  }
  console.log(`Inserted ${rows.length} catalog rows.`);
  const byCat: Record<string, number> = {};
  for (const r of rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  console.log("by category:", JSON.stringify(byCat));
}
main();
