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

/* Soft-launch notice bar across the top of every marketing page. Set
   siteNotice to null to remove the bar (the header and page offset
   collapse back automatically). `short` shows on mobile, `long` on
   wider screens; the email renders as a mailto link after it. */
export type SiteNotice = { short: string; long: string; email: string };
export const siteNotice: SiteNotice | null = {
  short: "Still improving the site. Contact",
  long: "We're still improving the site. If anything goes wrong, contact us at",
  email: "hi@ghlvideo.com",
};

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
