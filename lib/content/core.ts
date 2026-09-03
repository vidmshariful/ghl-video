/* The load-bearing facts, in ONE place. Anything on any of the 4 parts that
 * shows the client count, the Google rating, the premade delivery window, or
 * the founding year reads these constants, so changing a number here updates
 * every page. (`npm run check:drift` guards the DB prices the same way.) */
export const clients = 1000; // always rendered as "1000+"
export const rating = "5.0";
export const deliveryWindow = "5 to 7 days"; // premade turnaround after brief
export const studioSince = "2020"; // founding year, phrased "since 2020"

export const site = {
  name: "GHL Video",
  /* www is the canonical host: the server 308s the bare domain to www, and
     Search Console confirms Google selects www as the canonical too. This
     string feeds every canonical tag, the sitemap, robots.txt, OG urls, and
     the structured data, so it must match where visitors actually land. */
  url: "https://www.ghlvideo.com",
  email: "hi@ghlvideo.com",
  tagline: "Video built for HighLevel SaaS. Fast, custom, done.",
  description: `The video studio built only for the HighLevel ecosystem. White-label premade videos, custom production, and video editing service. ${clients}+ clients served, rated ${rating} on Google.`,
};

export const namedClients = [
  { name: "Dominic Bavaro", role: "CEO", company: "Emma.io" },
  { name: "Ryan Maule", role: "CEO", company: "AI Clinic Assist" },
  { name: "David Allen Neron", role: "CEO", company: "NeoLuxLabs" },
] as const;

/* ------------------------------------------------------------------ */
/* Navigation and fixed CTA vocabulary                                  */
/* ------------------------------------------------------------------ */

/* Services mega menu rows; posters reuse the media set */
export const navServices = [
  {
    name: "Premade Videos",
    line: `Branded HighLevel videos in ${deliveryWindow}`,
    href: "/premade/",
    posterKey: "sampleC",
  },
  {
    name: "Custom Production",
    line: "Scripted and produced for your ICP",
    href: "/custom-video/",
    posterKey: "featured",
  },
  {
    name: "Video Editing",
    line: "Monthly editing for weekly publishers",
    href: "/editing/",
    posterKey: "sampleB",
  },
] as const;

export const navLinks = [
  { label: "Our Work", href: "/work/" },
  { label: "Studio Insights", href: "/studio-insights/" },
  { label: "About Us", href: "/about/" },
  /* Free Resources + Knowledge Hub collapse into the Resources dropdown */
  { label: "Free Resources", href: "/resources/" },
  /* articles arrive from the HighLevel blog API; prerendered at build */
  { label: "Knowledge Hub", href: "/blog/" },
] as const;

/* CTA labels are fixed: never "Get Started" or "Learn More". */
export const cta = {
  bookACall: { label: "Book a Call", href: "/contact/" },
  seePremade: { label: "See premade videos", href: "/premade/" },
  /* the premade hero's first action: straight into the full catalogue
     rather than the featured strip further down the same page */
  browseLibrary: { label: "Browse the library", href: "/library/" },
  /* the editing hero's first action: down to the three plans on the page */
  seePlans: { label: "See the plans", href: "#plans" },
  requestQuote: { label: "Request a Quote", href: "/quote/" },
  orderPremade: "Order Now",
  startEditing: "Start editing",
} as const;

/* ------------------------------------------------------------------ */
/* Entity, disclaimer, sister brands                                    */
/* ------------------------------------------------------------------ */

export const entityLine = "A brand of Vidiosa LLC";
export const disclaimer =
  "GHL Video is not affiliated with or endorsed by HighLevel Inc.";
export const otherBrands = [
  { name: "growX", url: "https://growx.studio", domain: "growx.studio" },
  { name: "socialX", url: "https://socialx.studio", domain: "socialx.studio" },
] as const;

/* Where a happy client goes to leave a review.
 *
 * Content, not a secret, so it lives here with the rest of the content rather
 * than in the hosting settings: one less thing to set up, and it is visible in
 * the repo like every other public URL we publish. The wrap-up email omits the
 * ask entirely if this is ever emptied, so it can never render a dead button.
 */
export const googleReviewUrl = "https://g.page/r/CYSgGtPLCzEfEAE/review";

/* Soft-launch notice bar across the top of every marketing page. Set
   siteNotice to null to remove the bar (the header and page offset
   collapse back automatically). `short` shows on mobile, `long` on
   wider screens; the email renders as a mailto link after it. */
export type SiteNotice = { short: string; long: string; email: string };
/*
 * Off since September 2026 (owner decision).
 *
 * It was a soft-launch notice, and it stayed up long after the launch. On a
 * page selling between $97 and $3,495 the first line a buyer read was that
 * the site might break, which is the opposite of a trust signal. Its mailto
 * also overflowed the viewport by 7px at 375px.
 *
 * The bar and the header offset collapse on their own when this is null, so
 * putting an object back here is all it takes to bring it back for the next
 * real announcement.
 */
export const siteNotice: SiteNotice | null = null;

/* Social profiles from the live site. TODO: LinkedIn URL pending from
 * Shariful (no profile found on the current site). */
export const socials = [
  {
    name: "YouTube",
    href: "https://www.youtube.com/@ghlvideo_white-labeled",
  },
  { name: "Facebook", href: "https://www.facebook.com/ghlvideo" },
  { name: "Instagram", href: "https://www.instagram.com/ghlvideo" },
  { name: "LinkedIn", href: "#" },
] as const;

export const legalLinks = [
  { label: "Privacy", href: "/legal/privacy/" },
  { label: "Terms", href: "/legal/terms/" },
  { label: "Refund", href: "/legal/refund/" },
] as const;
