/*
 * The locked spec. Every price, count, name, URL, and line of recurring
 * copy lives here. Pages and components read from this file so nothing
 * drifts. Values come from the build brief and the final website plan.
 *
 * Asset fields set to null mean "real asset not delivered yet": the
 * components render a designed placeholder until the value is filled in.
 */

export const site = {
  name: "GHL Video",
  url: "https://ghlvideo.com",
  email: "hi@ghlvideo.com",
  orderBase: "https://order.ghlvideo.com",
  tagline: "Video built for HighLevel SaaS. Fast, custom, done.",
  description:
    "The specialized video studio built only for the HighLevel ecosystem. Premade videos at $495 flat, custom production with published starting prices, and monthly editing plans.",
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

export const nav = [
  { label: "Premade", href: "/premade/" },
  { label: "Custom", href: "/custom/" },
  { label: "Editing", href: "/editing/" },
  { label: "About", href: "/about/" },
] as const;

/* CTA labels are fixed: never "Get Started" or "Learn More". */
export const cta = {
  bookACall: { label: "Book a Call", href: "/contact/" },
  seePremade: { label: "See premade videos", href: "/premade/" },
  requestQuote: { label: "Request a Quote", href: "/quote/" },
  orderPremade: "Order for $495",
  startEditing: "Start editing",
} as const;

/* ------------------------------------------------------------------ */
/* Services and pricing (locked)                                        */
/* ------------------------------------------------------------------ */

export const premadePrice = 495; // flat, every premade video

export type PremadeVideo = {
  slug: string;
  title: string;
  purpose: string;
  price: number;
  preview: string | null; // mp4 path when the real previews land
  poster: string | null;
  orderUrl: string;
};

/* 10 placeholders. The real titles, previews, and SKUs drop in later
 * with no layout change. */
export const premadeVideos: PremadeVideo[] = Array.from({ length: 10 }).map(
  (_, i) => ({
    slug: `video-${i + 1}`,
    title: `Premade Video ${i + 1}`,
    purpose: "One line on what this video is for",
    price: premadePrice,
    preview: null,
    poster: null,
    orderUrl: `https://order.ghlvideo.com/video-${i + 1}`,
  }),
);

export const customFormats = [
  { name: "Ads / Promo", from: 1500, sample: null as string | null },
  { name: "Explainer", from: 2500, sample: null as string | null },
  { name: "Demo", from: 3500, sample: null as string | null },
  { name: "Onboarding Series", from: 5000, sample: null as string | null },
] as const;

export const editingPlans = [
  {
    name: "Starter",
    price: 595,
    longForm: 2,
    longFormNote: "up to 15 min each",
    shortForm: 4,
    featured: false,
    orderUrl: "https://order.ghlvideo.com/editing-starter",
  },
  {
    name: "Growth",
    price: 995,
    longForm: 4,
    shortForm: 8,
    featured: true,
    orderUrl: "https://order.ghlvideo.com/editing-growth",
  },
  {
    name: "Scale",
    price: 1795,
    longForm: 8,
    shortForm: 16,
    featured: false,
    note: "priority queue",
    orderUrl: "https://order.ghlvideo.com/editing-scale",
  },
] as const;

export const editingAllPlans =
  "No contracts, unlimited revisions, edited by a HighLevel-fluent team.";

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

export const legalLinks = [
  { label: "Privacy", href: "/legal/privacy/" },
  { label: "Terms", href: "/legal/terms/" },
  { label: "Refund", href: "/legal/refund/" },
] as const;

/* ------------------------------------------------------------------ */
/* Homepage content                                                     */
/* ------------------------------------------------------------------ */

export const showreel = {
  /* Fill src and poster when the real reel is delivered. Until then the
   * hero renders the ambient placeholder and everything else is final. */
  src: null as string | null,
  poster: null as string | null,
  /* Drives the "now playing" caption. Placeholder pairings until the
   * real reel segment list lands. */
  segments: [
    { format: "Onboarding Series", client: "NeoLuxLabs" },
    { format: "Platform Demo", client: "Emma.io" },
    { format: "Explainer", client: "AI Clinic Assist" },
  ],
};

export const home = {
  hero: {
    eyebrow: "The HighLevel-only video studio",
    headline: "Video built for",
    headlineAccent: "HighLevel SaaS.",
    lede: "Premade videos when speed matters, custom production when it has to be yours, and monthly editing for creators who publish every week.",
    signal: "Premade from $495",
  },

  bento: {
    eyebrow: "Three ways in",
    headline: "Pick your speed.",
    premade: {
      label: "Premade",
      title: "Branded HighLevel videos, $495 flat.",
      body: "Ten videos, each customized with your logo, your dashboard theme, and your voiceover. Delivered in 5 to 7 days.",
      linkLabel: "See premade videos",
      href: "/premade/",
    },
    custom: {
      label: "Custom",
      title: "Built from scratch for your platform.",
      body: "Ads, explainers, demos, and onboarding series, scripted and produced for your ICP.",
      priceLine: "From $1,500",
      linkLabel: "See formats and pricing",
      href: "/custom/",
    },
    editing: {
      label: "Editing for creators",
      title: "Your in-house HighLevel editor, on a monthly plan.",
      body: "Long-form and short-form, edited by a team that knows the ecosystem.",
      priceLine: "Plans from $595/mo",
      linkLabel: "See editing plans",
      href: "/editing/",
    },
  },

  featuredWork: {
    eyebrow: "The work",
    /* Spec values are placeholders until the real featured piece is
     * chosen. Swap here only. */
    client: "NeoLuxLabs",
    format: "Onboarding Series",
    whiteLabel: "From frame one",
    src: null as string | null,
    poster: null as string | null,
  },

  why: {
    eyebrow: "Why GHL Video",
    headline: "You built on HighLevel. So did we.",
    points: [
      {
        lead: "HighLevel only.",
        rest: "You never explain your own platform to us.",
      },
      {
        lead: "In-house team.",
        rest: "Full-time creatives, nothing outsourced or subcontracted.",
      },
      {
        lead: "Published pricing.",
        rest: "Every price on the page, no hidden quotes.",
      },
      {
        lead: "White label.",
        rest: "Your brand from the first frame, nothing points back to us.",
      },
      {
        lead: "Days, not months.",
        rest: "Premade delivers in 5 to 7 days. Custom moves just as deliberately.",
      },
    ],
  },

  audiences: {
    eyebrow: "Two audiences",
    resellers: {
      label: "For SaaS resellers",
      title: "Sell and onboard under your own brand.",
      body: "Premade videos to move fast, custom production when it has to be yours. Fluent in MRR, churn, and what a demo has to do.",
      links: [
        { label: "Premade videos", href: "/premade/" },
        { label: "Custom production", href: "/custom/" },
      ],
    },
    creators: {
      label: "For HighLevel creators",
      title: "Publish every week without owning the edit.",
      body: "A HighLevel-fluent editing team on a monthly plan. No contracts, unlimited revisions.",
      links: [{ label: "Editing plans", href: "/editing/" }],
    },
  },

  /* DRAFT COPY: these quotes are written in-voice as placeholders and
   * must be replaced with real client words before launch. Flagged to
   * Shariful. The names, roles, and companies are locked and real. */
  testimonials: [
    {
      quote:
        "They already knew the platform, so we skipped the briefing and went straight to output. The videos sell Emma better than our old demos ever did.",
      name: "Dominic Bavaro",
      role: "CEO",
      company: "Emma.io",
      lead: true,
      draft: true,
    },
    {
      quote:
        "Every video came back branded like we made it in-house. Our demos finally match the price we charge.",
      name: "Ryan Maule",
      role: "CEO",
      company: "AI Clinic Assist",
      lead: false,
      draft: true,
    },
    {
      quote:
        "Fast, on brand, and zero hand-holding. The first vendor we have not had to manage.",
      name: "David Allen Neron",
      role: "CEO",
      company: "NeoLuxLabs",
      lead: false,
      draft: true,
    },
  ],

  closing: {
    headline: "Stop selling with",
    accent: "Loom demos.",
    lede: "Talk to the original HighLevel-only video team about your next launch.",
  },
} as const;

export const footerBlurb = "Video built for HighLevel SaaS. Fast, custom, done.";
