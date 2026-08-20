/*
 * The canonical list of pages this site ships. Single source of truth:
 * the sitemap AND the admin Pages screen both read this file, so the
 * two can never disagree. inNav=false marks pages reachable only by
 * direct link (the admin surfaces those links).
 */
export type SitePage = {
  name: string;
  path: string;
  inNav: boolean;
  /* kept out of search results by the page itself. The sitemap reads this
     (a noindex page must never be listed), and the admin SEO screen shows
     it so nobody wonders why a page is missing from Google. Admin can also
     mark a page noindex at runtime; both sources are honored. */
  noindex?: boolean;
  note?: string;
};

export const sitePages: readonly SitePage[] = [
  { name: "Homepage", path: "/", inNav: true },
  { name: "Premade Videos", path: "/premade/", inNav: true },
  { name: "Custom Video Production", path: "/custom-video/", inNav: true },
  { name: "Video Editing", path: "/editing/", inNav: true },
  { name: "HighLevel Demo Video (SEO page)", path: "/highlevel-demo-video/", inNav: false, note: "direct link only" },
  { name: "HighLevel Video Bundle (SEO page)", path: "/highlevel-video-bundle/", inNav: false, note: "direct link only" },
  { name: "Our Work", path: "/work/", inNav: true },
  { name: "About", path: "/about/", inNav: true },
  { name: "Contact / Book a Call", path: "/contact/", inNav: true },
  { name: "Request a Quote", path: "/quote/", inNav: false, note: "linked from CTAs only" },
  { name: "Blog", path: "/blog/", inNav: true, note: "posts managed in admin, CMS, Blog" },
  { name: "Studio Insights", path: "/studio-insights/", inNav: true },
  { name: "Free Resources", path: "/resources/", inNav: true, noindex: true, note: "stub" },
  { name: "AI First SaaS Pack Launch", path: "/ai-first-launch/", inNav: false, noindex: true, note: "unlisted campaign, email only" },
  { name: "Shared shortlist", path: "/list/", inNav: false, noindex: true, note: "opened by an unguessable token, one per shared list" },
  { name: "Privacy Policy", path: "/legal/privacy/", inNav: false, note: "footer" },
  { name: "Terms", path: "/legal/terms/", inNav: false, note: "footer" },
  { name: "Refund Policy", path: "/legal/refund/", inNav: false, note: "footer" },
  { name: "Partner Program Terms", path: "/legal/partner-terms/", inNav: false, note: "direct link only" },
] as const;
