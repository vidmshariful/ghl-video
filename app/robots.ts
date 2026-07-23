import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/* Explicitly open to every search-tier and training-tier AI crawler:
 * blocking search bots removes citation eligibility, blocking training
 * bots removes the brand from what future models know. The wildcard
 * already allows everything; the named entries state intent. */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
];

/* Non-marketing routes: never index the app surfaces. They also carry a
 * noindex meta, but disallowing here keeps them out of crawl entirely. */
const DISALLOW = ["/admin/", "/portal/", "/checkout/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
