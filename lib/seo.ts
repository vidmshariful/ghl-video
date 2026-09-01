import type { Metadata } from "next";
import { SB_ANON, SB_URL } from "@/lib/supabase-config";

/*
 * Per-page SEO overrides, edited in admin (CMS -> SEO -> Pages) and merged
 * into each page's built-in metadata.
 *
 * FAILURE POLICY (the lesson lib/chrome.ts records): the DEFAULTS LIVE IN
 * CODE. This module only overrides them. A slow, unreachable, or empty
 * backend returns no overrides and every page keeps the title, description,
 * and canonical it ships with. Nothing here can blank a title tag, and
 * nothing here can accidentally de-index a page that is not explicitly
 * marked noindex in the database.
 */
export type SeoOverride = {
  path: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  /* null = not set, true = force hide, false = force show */
  noindex: boolean | null;
};

/** Canonical page path: leading and trailing slash, lowercase, no query. */
export function normalizePath(input: string): string {
  let p = (input || "/").trim().split("?")[0].split("#")[0].toLowerCase();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.endsWith("/")) p = `${p}/`;
  return p.replace(/\/{2,}/g, "/");
}

/* One fetch per window for the whole (small) table, so a page render costs
 * nothing extra and the pages stay statically cached. The window is short and
 * saving in admin purges the tag outright, so an edit is live in seconds.
 * Returns an empty map on any failure: the code defaults then stand. */
async function fetchOverrides(): Promise<Record<string, SeoOverride>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/seo_pages?select=path,title,description,og_image,noindex`,
      {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        signal: ctrl.signal,
        next: { revalidate: 60, tags: ["seo-pages"] },
      },
    );
    if (!res.ok) return {};
    const rows = (await res.json()) as SeoOverride[];
    const map: Record<string, SeoOverride> = {};
    for (const r of rows) map[normalizePath(r.path)] = r;
    return map;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export async function getSeoOverrides(): Promise<Record<string, SeoOverride>> {
  return fetchOverrides();
}

export async function getSeoOverride(path: string): Promise<SeoOverride | null> {
  const map = await fetchOverrides();
  return map[normalizePath(path)] ?? null;
}

/*
 * Merge a page's built-in metadata with its admin override.
 *
 * The title is applied as `absolute` on purpose: the site layout carries a
 * "%s | GHL Video" template, and an admin who types a full title in the SEO
 * editor means exactly that string. Absolute stops the template appending the
 * brand a second time, and the editor's preview shows the same result Google
 * will. Pages that are not overridden keep the templated title they have now.
 */
export async function pageMetadata(
  path: string,
  defaults: Metadata,
): Promise<Metadata> {
  const o = await getSeoOverride(path);
  if (!o) return defaults;

  const merged: Metadata = { ...defaults };
  const title = o.title?.trim();
  const description = o.description?.trim();

  if (title) merged.title = { absolute: title };
  if (description) merged.description = description;

  /*
   * Three states, and the false case is the one that used to be missing.
   * Before, false was indistinguishable from "not set", so an override could
   * hide a page but never reveal one whose code said index:false. That is why
   * the blog sat hidden for months behind a comment claiming otherwise.
   */
  if (o.noindex === true) merged.robots = { index: false, follow: true };
  else if (o.noindex === false) merged.robots = { index: true, follow: true };

  if (title || description || o.og_image) {
    const baseOg = (defaults.openGraph ?? {}) as Record<string, unknown>;
    merged.openGraph = {
      ...baseOg,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(o.og_image ? { images: [{ url: o.og_image }] } : {}),
    } as Metadata["openGraph"];
  }

  return merged;
}
