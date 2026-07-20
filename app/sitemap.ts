import type { MetadataRoute } from "next";
import { sitePages } from "@/lib/pages-list";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/* stubs stay out until they carry real content (they are noindex) */
const EXCLUDE = ["/blog/", "/resources/"];

export default function sitemap(): MetadataRoute.Sitemap {
  return sitePages
    .filter((p) => !EXCLUDE.includes(p.path))
    .map((p) => ({
      url: `${site.url}${p.path}`,
      changeFrequency: p.path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: p.path === "/" ? 1 : p.path.startsWith("/legal") ? 0.2 : 0.8,
    }));
}
