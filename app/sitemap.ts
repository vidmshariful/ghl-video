import type { MetadataRoute } from "next";
import { sitePages } from "@/lib/pages-list";
import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { site } from "@/lib/site";

/* Static pages from the canonical page list, plus the live blog (posts and
 * non-empty categories from the database). Refreshes hourly; publishing in
 * admin also revalidates it directly. */
export const revalidate = 3600;

/* stubs stay out until they carry real content (they are noindex), and
 * the unlisted campaign page never goes in */
const EXCLUDE = ["/resources/", "/ai-first-launch/"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = sitePages
    .filter((p) => !EXCLUDE.includes(p.path))
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
