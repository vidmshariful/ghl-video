import { SB_URL, SB_ANON } from "@/lib/supabase-config";
import { buildCatalogRows, type CatalogRow } from "@/lib/catalog-scheme";

export type { CatalogRow } from "@/lib/catalog-scheme";

const SELECT =
  "code,old_code,title,subject,category,kind,library,price_cents,video_url,poster_url,wistia_id,pack_count,featured,release_date,on_site,coming_soon,sort";

/*
 * The catalog the marketing library renders from. Reads the `catalog` table
 * (admin-managed) at build/revalidate, and falls back to the code catalog if
 * the backend is slow, unreachable, or returns a suspiciously short list.
 *
 * This mirrors the hard lesson behind lib/chrome.ts: a flaky backend must never
 * bake an empty or partial library into a deploy. So we treat the DB as the
 * source of truth WHEN healthy, and the code catalog as an always-complete
 * safety net. Runtime revalidation is stale-while-revalidate, so a failed
 * refresh keeps serving the last good render rather than an empty one.
 */
export async function getCatalog(): Promise<CatalogRow[]> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/catalog?on_site=eq.true&select=${SELECT}&order=sort.asc`,
      {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        next: { revalidate: 300, tags: ["catalog"] },
      },
    );
    if (res.ok) {
      const rows = (await res.json()) as CatalogRow[];
      // sanity floor: the real catalog is ~69 rows; anything far short means a
      // partial/failed read, so prefer the complete code fallback.
      if (Array.isArray(rows) && rows.length >= 40) return rows;
    }
  } catch {
    // network/DB failure: fall through to the code catalog
  }
  return buildCatalogRows();
}

/* the ISO cutoff for the Recent Launch rolling window. Lives here (not in the
 * page render) so the clock read stays out of a component body. */
export function recentCutoff(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/*
 * The current catalog code for a retired checkout sku, via the catalog's
 * old_code map, or null. Lets /checkout/<oldsku> 308-forward to the canonical
 * new code (e.g. short-001 -> fexp-031) instead of 404ing. Returns null when
 * the old code was reused as a live code (never redirect a code onto itself).
 */
export async function newCodeForOldSku(oldSku: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/catalog?old_code=eq.${encodeURIComponent(oldSku)}&select=code&limit=1`,
      { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` }, cache: "no-store" },
    );
    if (res.ok) {
      const rows = (await res.json()) as { code: string }[];
      const code = rows?.[0]?.code;
      if (code && code !== oldSku) return code;
    }
  } catch {
    // ignore: fall back to notFound in the caller
  }
  return null;
}
