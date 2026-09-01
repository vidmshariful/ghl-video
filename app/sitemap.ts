import type { MetadataRoute } from "next";
import { sitePages } from "@/lib/pages-list";
import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { getSeoOverrides } from "@/lib/seo";
import { site } from "@/lib/site";

/* Static pages from the canonical page list, plus the live blog (posts and
 * non-empty categories from the database). Refreshes hourly; publishing in
 * admin also revalidates it directly. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A noindex page must never be listed here. Two sources say so: the page
  // list (stubs and the unlisted campaign page) and the admin SEO screen,
  // so flipping noindex in admin also removes the page from the sitemap.
  const overrides = await getSeoOverrides();
  /* The override wins in BOTH directions, so a page the admin has switched on
     appears here even if the page list calls it noindex, and the sitemap can
     never again advertise a page that refuses to be indexed. */
  const effectiveNoindex = (p: { path: string; noindex?: boolean }) => {
    const ov = overrides[p.path]?.noindex;
    return ov === true || ov === false ? ov : p.noindex === true;
  };

  const fixed = sitePages
    .filter((p) => !effectiveNoindex(p))
    .map((p) => ({
      url: `${site.url}${p.path}`,
      changeFrequency:
        p.path === "/" || p.path === "/blog/" ? ("weekly" as const) : ("monthly" as const),
      priority: p.path === "/" ? 1 : p.path.startsWith("/legal") ? 0.2 : 0.8,
    }));

  const [posts, cats] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const usedCats = new Set(posts.map((p) => p.category_id).filter(Boolean));

  const postEntries = posts.map((p) => ({
    url: `${site.url}/blog/${p.slug}/`,
    lastModified: p.published_at,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const catEntries = cats
    .filter((c) => usedCats.has(c.id))
    .map((c) => ({
      url: `${site.url}/blog/category/${c.slug}/`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

  return [...fixed, ...postEntries, ...catEntries];
}
