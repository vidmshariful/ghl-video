import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/* Core pages only; stubs for /resources and /blog stay out until they
 * carry real content. */
const routes = [
  "/",
  "/premade/",
  "/custom-video/",
  "/quote/",
  "/editing/",
  "/work/",
  "/about/",
  "/contact/",
  "/legal/privacy/",
  "/legal/terms/",
  "/legal/refund/",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path.startsWith("/legal") ? 0.2 : 0.8,
  }));
}
