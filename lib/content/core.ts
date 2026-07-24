export const site = {
  name: "GHL Video",
  url: "https://ghlvideo.com",
  email: "hi@ghlvideo.com",
  tagline: "Video built for HighLevel SaaS. Fast, custom, done.",
  description:
    "The video studio built only for the HighLevel ecosystem: a white-label premade library, custom production with published starting prices, and monthly editing for HighLevel creators. 800+ teams served, rated 5.0 on Google.",
};

export const clients = 800; // always rendered as "800+"
export const rating = "5.0";

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
    line: "Branded HighLevel videos in 5 to 7 days",
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
  { label: "About Us", href: "/about/" },
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
  "GHL Video is not affiliated with or endorsed by GoHighLevel Inc.";
export const otherBrands = [
  { name: "growX", url: "https://growx.studio", domain: "growx.studio" },
  { name: "socialX", url: "https://socialx.studio", domain: "socialx.studio" },
] as const;

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
