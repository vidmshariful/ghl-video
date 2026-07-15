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
    "The specialized video studio built only for the HighLevel ecosystem. A white-label AI-first video pack for resellers, custom production with published starting prices, and monthly editing plans.",
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
    accent: "gold",
    posterKey: "sampleC",
  },
  {
    name: "Custom Production",
    line: "Scripted and produced for your ICP",
    href: "/custom/",
    accent: "green",
    posterKey: "featured",
  },
  {
    name: "Video Editing",
    line: "Monthly editing for weekly publishers",
    href: "/editing/",
    accent: "blue",
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
  orderPremade: "Order for $495",
  startEditing: "Start editing",
} as const;

/* ------------------------------------------------------------------ */
/* Media assets                                                         */
/* ------------------------------------------------------------------ */

/* Placeholder clips on the LeadConnector CDN. Finals swap in here with
 * no layout change. NOTE: clips 3 and 4 are heavy masters (220MB and
 * 611MB); fine as hover-streamed placeholders, but compress the finals
 * before launch. */
export const clips = {
  /* reel is unwired for now: the hero is an abstract atmosphere until
   * a real showreel exists (client call, this pass) */
  reel: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a09af05dbe569a25d999f9f.mp4",
  featured:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69abf862b003fa1d8009b203.mp4",
  sampleA:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69ac030ab003fa4f250a8483.mp4",
  sampleB:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69a5aa2c753f15417fa8fbe1.mp4",
  sampleC:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6984930e1dfc023b2d7fb5b4.mp4",
  /* a real premade (the AI-first master explainer) for the premade
   * service panel, so the homepage previews actual product */
  premadeNew:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a54fdf79c9b37b5fd24a140.mp4",
} as const;

export const posters = {
  reel: "/posters/clip-1.jpg",
  featured: "/posters/clip-2.jpg",
  sampleA: "/posters/clip-3.jpg",
  sampleB: "/posters/clip-4.jpg",
  sampleC: "/posters/clip-5.jpg",
  premadeNew: "/posters/ai-master.jpg",
} as const;

/* Curated ambient-loop windows per clip: every frame that plays a clip
 * loops inside its window, so title cards and blank intros never show.
 * The lightbox always plays the full clip from the start. */
export const clipWindows: Partial<
  Record<keyof typeof clips, { startAt: number; endAt?: number }>
> = {
  featured: { startAt: 45, endAt: 53.5 },
  sampleA: { startAt: 73, endAt: 76 },
};

/* ------------------------------------------------------------------ */
/* Services and pricing (locked)                                        */
/* ------------------------------------------------------------------ */

export const premadePrice = 495; // legacy flat price, kept for reference

/* The premade catalog's video types; filters use them. "Feature
 * Explainer" is the short, single-feature cut (formerly "Short
 * Explainer"); "Explainer" is now reserved for the master and pitch. */
export const premadeTypes = [
  "Explainer",
  "Feature Explainer",
  "Demo",
  "Ads / Promo",
  "Animated GIF",
] as const;
export type PremadeType = (typeof premadeTypes)[number];

/* Real AI First SaaS Pack videos on the LeadConnector CDN. Four are
 * delivered; five are in production (comingSoon). */
const aiPackClips = {
  master:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a54fdf79c9b37b5fd24a140.mp4",
  receptionist:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a54fdf79c9b37b5fd24a12f.mp4",
  inbox:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a54fdf79c9b37b5fd24a134.mp4",
  reputation:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a54fdf7baf5f6da40a950de.mp4",
} as const;

export type PackVideo = {
  title: string;
  type: PremadeType;
  format: string; // Master Explainer | Short Explainer | Platform Demo
  capability: string; // the feature the video sells; drives the library filter
  src: string | null; // null while in production
  poster: string | null;
  comingSoon?: boolean;
  startAt?: number;
  endAt?: number;
};

export type PackCategory = {
  name: string;
  count: number | null;
  line: string;
  videos: PackVideo[];
};

export type PremadePack = {
  slug: string;
  name: string;
  tagline: string;
  count: number | null;
  price: number | null;
  anchorPrice?: number | null;
  orderUrl: string | null;
  categories: PackCategory[];
};

/* One pack at launch: the AI First SaaS Pack (real). FLAG: the
 * order.ghlvideo.com checkout URL is a PLACEHOLDER SKU. Five of the
 * nine videos are in production and marked comingSoon. */
export const premadePacks: PremadePack[] = [
  {
    slug: "ai-first-saas-pack",
    name: "AI First SaaS Pack",
    tagline:
      "An AI-first, white-label video system for HighLevel SaaS resellers. Nine outcome-led videos with brand-agnostic scripts, ready to deploy across your whole funnel: homepage, sales pages, ads, email, and demos.",
    count: 9,
    price: 1995,
    anchorPrice: 3495,
    orderUrl: "https://order.ghlvideo.com/ai-first-saas-pack",
    categories: [
      {
        name: "Master Explainer",
        count: 1,
        line: "All-in-one plus AI-first positioning in 90 to 120 seconds. The video that sells your platform before the first call.",
        videos: [
          {
            title: "All-in-one + AI-First Positioning",
            type: "Explainer",
            format: "Master Explainer",
            capability: "All-in-one",
            src: aiPackClips.master,
            poster: "/posters/ai-master.jpg",
          },
        ],
      },
      {
        name: "Feature Explainers",
        count: 7,
        line: "One 60-second explainer per core capability, with AI woven through the how-it-works.",
        videos: [
          {
            title: "AI Receptionist + Conversational AI",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "AI Receptionist",
            src: aiPackClips.receptionist,
            poster: "/posters/ai-receptionist.jpg",
          },
          {
            title: "Unified Inbox + Conversational AI",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "Unified Inbox",
            src: aiPackClips.inbox,
            poster: "/posters/ai-inbox.jpg",
          },
          {
            title: "Reputation Management + Reviews AI",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "Reputation & Reviews",
            src: aiPackClips.reputation,
            poster: "/posters/ai-reputation.jpg",
          },
          {
            title: "Social Media Planner + Content AI",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "Social & Content",
            src: null,
            poster: null,
            comingSoon: true,
          },
          {
            title: "AI Website + Funnel Builder",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "Websites & Funnels",
            src: null,
            poster: null,
            comingSoon: true,
          },
          {
            title: "Ask AI, Your In-Platform Assistant",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "Ask AI",
            src: null,
            poster: null,
            comingSoon: true,
          },
          {
            title: "Mobile App, Run Your Business From Your Phone",
            type: "Feature Explainer",
            format: "Feature Explainer",
            capability: "Mobile App",
            src: null,
            poster: null,
            comingSoon: true,
          },
        ],
      },
      {
        name: "Platform Demo",
        count: 1,
        line: "A 5-minute lead-to-close walkthrough with AI at every stage of the funnel.",
        videos: [
          {
            title: "Lead-to-Close With AI",
            type: "Demo",
            format: "Platform Demo",
            capability: "Lead-to-close",
            src: null,
            poster: null,
            comingSoon: true,
          },
        ],
      },
    ],
  },
];

/* Individual per-video pricing by type: explainers $495, demo $995.
 * FLAG: Ads / Promo and Animated GIF prices are placeholder defaults. */
export const premadeTypePrice: Record<PremadeType, number> = {
  Explainer: 495,
  "Feature Explainer": 495,
  Demo: 995,
  "Ads / Promo": 495,
  "Animated GIF": 495,
};

const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* The "All videos" browser reads a flat list aggregated from every
 * pack, so the catalog and the playlists never drift. Each video is
 * individually purchasable (price by type) AND bundled in its pack.
 * Finished videos preview and sell on their own; comingSoon videos
 * ship with their pack when they release. Per-SKU checkout URLs are
 * PLACEHOLDERS. */
export type PremadeVideo = {
  slug: string;
  title: string;
  type: PremadeType;
  format: string;
  capability: string;
  price: number;
  preview: string | null;
  poster: string | null;
  orderUrl: string;
  comingSoon: boolean;
};

const packVideos: PremadeVideo[] = premadePacks
  .flatMap((pack) => pack.categories.flatMap((c) => c.videos))
  .reduce<PremadeVideo[]>((acc, v) => {
    const slug = slugify(v.title);
    if (acc.some((x) => x.slug === slug)) return acc; // dedupe across packs
    acc.push({
      slug,
      title: v.title,
      type: v.type,
      format: v.format,
      capability: v.capability,
      price: premadeTypePrice[v.type],
      preview: v.src,
      poster: v.poster,
      orderUrl: `https://order.ghlvideo.com/${slug}`,
      comingSoon: v.comingSoon ?? false,
    });
    return acc;
  }, []);

/* Standalone new videos not tied to a pack. The HighLevel pitch (its
 * Complete Brand Customization cut) lives in the new library as well as
 * the HighLevel x GHL Video collab tab. */
const standaloneNew: PremadeVideo[] = [
  {
    slug: "highlevel-official-full-platform-pitch",
    title: "HighLevel's Official Full Platform Pitch",
    type: "Explainer",
    format: "Full Platform Pitch",
    capability: "Full platform overview",
    price: 495,
    preview:
      "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a56fa0fbaf5f6da40287c33.mp4",
    poster: null,
    orderUrl: "https://order.ghlvideo.com/hl-full-pitch-video",
    comingSoon: false,
  },
];

export const premadeVideos: PremadeVideo[] = [...packVideos, ...standaloneNew];

/* Look up a video's individual price and checkout by title (packs use
 * this to offer the single-video buy alongside the pack). */
export const premadeBySlugTitle: Record<string, PremadeVideo> =
  Object.fromEntries(premadeVideos.map((v) => [v.title, v]));

/* Library sidebar filters, computed from the real catalog so they grow
 * with it. */
export const premadeFilterGroups = {
  type: premadeTypes.filter((t) => premadeVideos.some((v) => v.type === t)),
  capability: [...new Set(premadeVideos.map((v) => v.capability))],
} as const;

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

/* ------------------------------------------------------------------ */
/* Homepage content                                                     */
/* ------------------------------------------------------------------ */

/* The live Google reviews for GHL Video (5.00, 17 reviews). */
export const googleReviewsUrl =
  "https://www.google.com/search?q=ghl+video#lrd=0x3755c3a3394f03b9:0x1f310bcbd31aa084,1";

/* Trust bar logo wall: the three named clients are real; the rest are
 * PLACEHOLDER marks until Shariful clears the real client logos. */
export const trustLogos = [
  { name: "Emma.io", placeholder: false },
  { name: "Brightstack", placeholder: true },
  { name: "AI Clinic Assist", placeholder: false },
  { name: "Cloudpeak", placeholder: true },
  { name: "NeoLuxLabs", placeholder: false },
  { name: "Loopwise", placeholder: true },
] as const;

/* The newest real videos, used as live examples across the site (home
 * showreel, Our Work) instead of the heavy placeholder clips. Sourced
 * from the AI-first pack plus the branded pitch cut. */
export const newSamples = [
  {
    src: aiPackClips.master,
    poster: "/posters/ai-master.jpg",
    title: "All-in-one + AI-First Positioning",
    format: "Master Explainer",
  },
  {
    src: aiPackClips.receptionist,
    poster: "/posters/ai-receptionist.jpg",
    title: "AI Receptionist + Conversational AI",
    format: "Feature Explainer",
  },
  {
    src: aiPackClips.inbox,
    poster: "/posters/ai-inbox.jpg",
    title: "Unified Inbox + Conversational AI",
    format: "Feature Explainer",
  },
  {
    src: aiPackClips.reputation,
    poster: "/posters/ai-reputation.jpg",
    title: "Reputation Management + Reviews AI",
    format: "Feature Explainer",
  },
  {
    src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a56fa0fbaf5f6da40287c33.mp4",
    poster: null,
    title: "HighLevel's Official Full Platform Pitch",
    format: "Full Platform Pitch",
  },
] as const;

/* NOTE (per Shariful): the homepage shows NO prices for any service.
 * Pricing lives on the service pages. Premade pricing is also moving
 * off a single flat figure; final premade price model pending. */
export const home = {
  hero: {
    eyebrow: "The HighLevel-only video studio",
    headline: "Video built for",
    headlineAccent: "HighLevel SaaS.",
    lede: "Premade videos when speed matters, custom production when it has to be yours, and monthly editing for creators who publish every week.",
    /* REAL Google review, quoted verbatim */
    testimonial: {
      quote:
        "Great quality and quick turnaround! Will definitely work with again!",
      name: "Ryan Maule",
      source: "Google review",
      photo: null as string | null,
    },
  },

  services: {
    chip: "Services",
    headline: "Three ways to",
    accent: "ship video.",
    intro:
      "Move fast with premade, go bespoke with custom, stay consistent with editing.",
    panels: [
      {
        name: "Premade Videos",
        title: "Branded HighLevel videos, ready in days.",
        body: "Pick from the launch set. Each video is customized with your logo, your dashboard theme, and your voiceover, then delivered in 5 to 7 days.",
        checklist: [
          "Your branding on every frame",
          "Dashboard theme matched to your SaaS",
          "Professional voiceover included",
          "Full commercial rights",
        ],
        linkLabel: "See premade videos",
        href: "/premade/",
        accent: "gold",
        mediaKey: "premadeNew",
      },
      {
        name: "Custom Production",
        title: "Built from scratch for your platform.",
        body: "Scripted, voiced, and animated for your ICP. Any language, any accent, produced by an in-house team that already knows HighLevel.",
        checklist: [
          "Ads and promo",
          "Explainer",
          "Demo",
          "Onboarding series",
        ],
        linkLabel: "See custom production",
        href: "/custom/",
        accent: "green",
        mediaKey: "featured",
      },
      {
        name: "Video Editing",
        title: "Your in-house HighLevel editor, on a monthly plan.",
        body: "For creators who publish every week. Send footage, get it back edited by a team that knows the ecosystem, publish on schedule.",
        checklist: [
          "No contracts",
          "Unlimited revisions",
          "HighLevel-fluent editing team",
        ],
        linkLabel: "See video editing",
        href: "/editing/",
        accent: "blue",
        mediaKey: "sampleB",
      },
    ],
  },

  manifesto: {
    eyebrow: "The problem",
    statement:
      "Your prospects judge your SaaS before they ever try it. A Loom demo and a DIY explainer tell them everything they need to know, and not in your favor.",
    /* the phrase lifted into gold; must be a substring of statement */
    emphasis: "before they ever try it",
    contrast: {
      bad: "A Loom demo or a DIY explainer",
      good: "A branded GHL Video",
    },
  },

  /* The real team, photos from the live site */
  team: {
    chip: "The team",
    headline: "Full time, in house,",
    accent: "not outsourced.",
    intro:
      "The same people work on your videos every time. That is what keeps quality and turnaround consistent.",
    members: [
      { name: "Shariful Islam", role: "Founder & CEO", photo: "/people/shariful.jpg" as string | null },
      { name: "Mostafa Afzal", role: "COO", photo: "/people/mostafa.jpg" as string | null },
      { name: "Tanvir Prince", role: "Executive Producer", photo: "/people/tanvir.jpg" as string | null },
      { name: "Dillon Strickland", role: "Sales Director", photo: "/people/dillon.jpg" as string | null },
    ],
  },

  /* PLACEHOLDER clips: real client testimonial videos replace these
   * (names and companies are the locked real clients). */
  videoTestimonials: {
    chip: "Client stories",
    headline: "Founders,",
    accent: "on camera.",
    items: [
      {
        name: "Dominic Bavaro",
        company: "Emma.io",
        src: clips.sampleA,
        poster: posters.sampleA,
        startAt: clipWindows.sampleA!.startAt,
        endAt: clipWindows.sampleA!.endAt,
      },
      {
        name: "Ryan Maule",
        company: "AI Clinic Assist",
        src: clips.sampleB,
        poster: posters.sampleB,
      },
      {
        name: "David Allen Neron",
        company: "NeoLuxLabs",
        src: clips.featured,
        poster: posters.featured,
        startAt: clipWindows.featured!.startAt,
        endAt: clipWindows.featured!.endAt,
      },
    ],
  },

  faq: {
    chip: "FAQ",
    headline: "Asked before",
    accent: "every order.",
    items: [
      {
        q: "Is everything really white label?",
        a: "Yes. Your logo, your dashboard theme, your voiceover. Nothing in the video points back to us, and full commercial rights are included.",
      },
      {
        q: "Do we have to explain HighLevel to you?",
        a: "No. We only work in the HighLevel ecosystem, so you skip the platform briefing entirely and go straight to output.",
      },
      {
        q: "How fast is delivery?",
        a: "Premade videos arrive in 5 to 7 days after you submit your branding. Custom timelines are scoped up front, in days and weeks, not months.",
      },
      {
        q: "How does the editing subscription work?",
        a: "Send footage, get it back edited, publish. Monthly plans with no contracts and unlimited revisions, edited by a HighLevel-fluent team.",
      },
      {
        q: "What happens after I book a call?",
        a: "We map what you need on the call, you submit your branding, and delivery starts from there. Scope is confirmed before any work begins.",
      },
    ],
  },

  work: {
    eyebrow: "The work",
    /* One featured piece plus two supporting clips, all hover-play. Our
     * newest real videos: the AI-first master and two feature cuts. */
    pieces: [
      {
        src: newSamples[0].src,
        poster: newSamples[0].poster,
        client: newSamples[0].title,
        format: newSamples[0].format,
      },
      {
        src: newSamples[1].src,
        poster: newSamples[1].poster,
        client: newSamples[1].title,
        format: newSamples[1].format,
      },
      {
        src: newSamples[3].src,
        poster: newSamples[3].poster,
        client: newSamples[3].title,
        format: newSamples[3].format,
      },
    ],
  },

  comparison: {
    eyebrow: "Head to head",
    headline: "Why HighLevel founders pick GHL Video.",
    intro:
      "The difference between a generalist vendor and a team that lives in your platform.",
    othersLabel: "Everyone else",
    usLabel: "GHL Video",
    rows: [
      {
        label: "Focus",
        others: "Video for anyone",
        us: "Only HighLevel, since day one",
      },
      {
        label: "Speed",
        others: "4 to 8 weeks",
        us: "5 to 7 days on premade",
      },
      {
        label: "Pricing",
        others: "Surprise invoices",
        us: "Published, fixed pricing",
      },
      {
        label: "Delivery",
        others: "Outsourced, no accountability",
        us: "In-house team, one point of contact",
      },
      {
        label: "Branding",
        others: "Generic templates",
        us: "White-label from the first frame",
      },
      {
        label: "The platform",
        others: "You explain it to them",
        us: "They already know HighLevel",
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

  /* REAL Google reviews, quoted verbatim from the 5.00-rated profile.
   * size drives the bento span. */
  reviews: {
    chip: "Proof",
    headline: "Rated 5.0 by",
    accent: "HighLevel founders.",
    ratingLine: "17 reviews on Google, every one of them five stars.",
    items: [
      {
        quote:
          "Outstanding video quality and an extremely smooth and pleasant customer experience. Tanvir and the team went way beyond our expectations to deliver some of the best white label GHL content we've ever seen.",
        name: "Ben Gallagher",
        size: "lg",
      },
      {
        quote:
          "I had a great experience working with GHL Video. They are very accommodating and willing to work with you on your needs to make sure you're totally happy with the results and all of the details. Would highly recommend using them to do your videos!",
        name: "Nick Demyanovich",
        size: "md",
      },
      {
        quote:
          "These quality social ad videos and fast turnaround times are well worth it and works great for setting demo appointments.",
        name: "Marketing Baristas",
        size: "sm",
      },
      {
        quote:
          "Super easy process, great pricing, and top-tier videos. GHL Video delivers every time!",
        name: "Kiwanna Clark",
        size: "sm",
      },
      {
        quote: "Best WL SaaS video. A++ Quality.",
        name: "Dillon Paul",
        size: "sm",
      },
      {
        quote: "Very good videos, fast delivery and very professional",
        name: "QuantumStack Ltd",
        size: "sm",
      },
      {
        quote:
          "Great quality and quick turnaround! Will definitely work with again!",
        name: "Ryan Maule",
        size: "sm",
      },
      {
        quote: "Great Service; thank-you Tanvir",
        name: "Robert Rushing",
        size: "sm",
      },
    ],
  },

  /* DRAFT line (Shariful sends the final wording); photo is real */
  founder: {
    name: "Shariful Islam",
    role: "Founder & CEO, GHL\u00A0Video",
    photo: "/people/shariful.jpg" as string | null,
    line: "Every HighLevel reseller I met was selling a serious platform with videos that undersold it. GHL Video exists to close that gap, with one team that never has to be taught the product.",
  },

  closing: {
    headline: "Stop selling with",
    accent: "Loom demos.",
    lede: "Talk to the original HighLevel-only video team about your next launch.",
    /* a real sequence, so numbering carries information */
    steps: [
      { title: "Book", line: "Pick a time that fits." },
      { title: "Scope", line: "We map your videos on the call." },
      { title: "Receive", line: "Premade lands in 5 to 7 days." },
    ],
  },
} as const;

export const footerBlurb = "Video built for HighLevel SaaS. Fast, custom, done.";

/* ------------------------------------------------------------------ */
/* Inner-page content                                                   */
/* ------------------------------------------------------------------ */

export const pages = {
  premade: {
    hero: {
      chip: "Premade Videos",
      headline: "Branded HighLevel videos,",
      accent: "ready when you are.",
      lede: "Browse the full library. Buy any video on its own, or get a complete pack and save. Every one is white-labeled to your SaaS.",
      priceSignal: "Videos from $495, packs from $1,495",
    },
    grid: {
      chip: "The library",
      headline: "Every video",
      accent: "and pack, in one place.",
      intro:
        "Filter the library on the left, or open a pack to browse it as a playlist. Preview any video, buy it on its own, or get the whole pack.",
    },
    included: {
      chip: "What's included",
      headline: "Every video ships",
      accent: "white-label.",
      items: [
        "Your logo and brand colors on every frame",
        "Your dashboard theme and platform screens",
        "Professional voiceover in your choice of accent",
        "Brand-agnostic scripts, no competitor named",
        "Full commercial rights, no attribution",
      ],
    },
    how: {
      chip: "How it works",
      headline: "Order today,",
      accent: "publish this week.",
      steps: [
        {
          title: "Order",
          line: "Pick a single video or a full pack and check out. No call required.",
        },
        {
          title: "Send your brand kit",
          line: "Logo, colors, dashboard screens, and voiceover preference through the intake form.",
        },
        {
          title: "Receive and publish",
          line: "We white-label every video to your SaaS and deliver after a full review round.",
        },
      ],
    },
    faq: {
      chip: "FAQ",
      headline: "Asked before",
      accent: "every order.",
      items: [
        {
          q: "Is the video really mine to use anywhere?",
          a: "Yes. Every premade ships with full commercial rights. Run it as an ad, embed it on your site, use it in onboarding. No attribution, no license tiers.",
        },
        {
          q: "How custom does each video get?",
          a: "Your logo, your brand colors, your dashboard screens, and your voiceover. The scripts are brand-agnostic by design, so nothing names a competitor and the pack white-labels cleanly for your SaaS.",
        },
        {
          q: "Some videos say coming soon. What does that mean?",
          a: "Four of the nine videos are finished and previewable today. The other five are in production and roll out to the pack as they release, at no extra cost.",
        },
        {
          q: "What if I need a different script or format?",
          a: "That is custom production. Starting prices are published on the custom page, and a quote takes one short form.",
        },
        {
          q: "How do I send my branding?",
          a: "After you order you get a short intake form: logo, colors, dashboard screens, and voiceover preference. Five minutes, then we take over.",
        },
      ],
    },
  },

  custom: {
    hero: {
      chip: "Custom Production",
      headline: "Custom video, built from scratch",
      accent: "for your platform and your ICP.",
      lede: "Scripted, voiced, and produced by an in-house team that already knows HighLevel. You explain your positioning once; we handle everything from script to final cut.",
    },
    formats: {
      chip: "The formats",
      headline: "Four formats,",
      accent: "published starting prices.",
      intro:
        "Every project is quoted exactly before production starts. These are the floors, not estimates.",
      items: [
        {
          name: "Ads / Promo",
          from: 1500,
          line: "Short, punchy, conversion-first. Built to stop the scroll and sell the click.",
          mediaKey: "sampleC",
        },
        {
          name: "Explainer",
          from: 2500,
          line: "Your positioning in 60 to 90 seconds. The video that does the first sales call for you.",
          mediaKey: "featured",
        },
        {
          name: "Demo",
          from: 3500,
          line: "Your actual platform, captured and narrated so prospects see the product win.",
          mediaKey: "sampleA",
        },
        {
          name: "Onboarding Series",
          from: 5000,
          line: "A full walkthrough series that cuts support tickets and activates new users.",
          mediaKey: "sampleB",
        },
      ],
    },
    pricing: {
      chip: "How pricing works",
      headline: "No estimates.",
      accent: "A fixed quote before we start.",
      points: [
        {
          title: "Published floors",
          line: "The starting prices above are real. No call required to learn the number.",
        },
        {
          title: "Exact quote in 24 hours",
          line: "Send the short quote form and we reply with a fixed price within a day.",
        },
        {
          title: "Locked before production",
          line: "The quote you approve is the price you pay. Scope changes are priced before work continues, never after.",
        },
      ],
    },
    process: {
      chip: "The process",
      headline: "Six steps,",
      accent: "no surprises.",
      steps: [
        {
          title: "Scope",
          line: "Quote form or a call. We map the goal, the audience, and the format.",
        },
        {
          title: "Script",
          line: "We write it in your voice. You approve every word before anything moves.",
        },
        {
          title: "Voice and style",
          line: "Voiceover casting in any language or accent, plus the visual direction.",
        },
        {
          title: "Production",
          line: "The in-house team builds the video. No handoffs to strangers.",
        },
        {
          title: "Review",
          line: "You give notes, we revise. The video ships when you say it ships.",
        },
        {
          title: "Delivery",
          line: "Final cuts in every format you need, with full commercial rights.",
        },
      ],
    },
    capabilities: [
      {
        title: "Any language, any accent",
        line: "Voiceover casting across markets, so your video sells wherever your SaaS does.",
      },
      {
        title: "In-house studio",
        line: "Script, design, animation, and edit under one roof. Nothing is outsourced.",
      },
      {
        title: "HighLevel fluency",
        line: "You never explain what a snapshot or a subaccount is. We already know.",
      },
    ],
    fit: {
      chip: "Fit",
      headline: "Built for some teams,",
      accent: "not for all.",
      forItems: [
        "HighLevel SaaS resellers with real positioning to communicate",
        "Agencies packaging HighLevel for a niche",
        "Platforms that need demo and onboarding coverage",
        "Founders who want video that matches the product's ambition",
      ],
      notItems: [
        "One-off personal projects outside the HighLevel ecosystem",
        "Same-week turnarounds. Custom takes the time it takes",
        "Teams shopping on price alone. Premade exists for that",
      ],
    },
  },

  quote: {
    chip: "Quote request",
    headline: "Tell us about",
    accent: "your project.",
    lede: "Five fields, no budget sliders. A human reads it and replies with a fixed quote within 24 hours.",
    /* LeadConnector form replaces this at launch; the interim form
     * opens a prefilled email to hi@ghlvideo.com so nothing dead-ends */
    fields: {
      name: "Your name",
      email: "Email",
      company: "Company or SaaS",
      type: "Video type",
      details: "What are we making?",
    },
    types: ["Ads / Promo", "Explainer", "Demo", "Onboarding Series", "Not sure yet"],
    confirmation: "Request sent. We reply within 24 hours.",
    fallback: "Prefer to talk it through?",
  },

  editing: {
    hero: {
      chip: "Video Editing",
      headline: "Your in-house HighLevel editor,",
      accent: "on a monthly plan.",
      lede: "For creators who publish every week. Send raw footage, get back edits from a team that knows the ecosystem, and never miss a publishing schedule again.",
    },
    plans: {
      chip: "The plans",
      headline: "Pick your",
      accent: "monthly capacity.",
      featuredLabel: "Most chosen",
    },
    samples: {
      chip: "The difference",
      headline: "Same footage,",
      accent: "different weight.",
      intro:
        "Raw talking-head footage in, publish-ready content out. Hooks, cuts, captions, and pacing handled.",
      before: { label: "Before", sub: "Raw footage" },
      after: { label: "After", sub: "Published edit" },
    },
    fit: {
      chip: "Fit",
      headline: "Made for people",
      accent: "who publish.",
      forItems: [
        "HighLevel creators publishing weekly",
        "Coaches and educators turning calls into content",
        "Founders building an audience alongside the product",
        "Agencies producing client content at volume",
      ],
      notItems: [
        "One-off edits. The plans are monthly capacity",
        "Same-day turnarounds on every video",
        "Full production from scratch. That is custom",
      ],
    },
    how: {
      chip: "How it works",
      headline: "Send footage,",
      accent: "get content.",
      steps: [
        {
          title: "Send",
          line: "Drop raw footage in your shared folder with a note on what you want.",
        },
        {
          title: "We edit",
          line: "Hooks, cuts, captions, b-roll, and pacing by a HighLevel-fluent editor.",
        },
        {
          title: "You publish",
          line: "Review, request unlimited revisions, publish on schedule.",
        },
      ],
    },
    faq: {
      chip: "FAQ",
      headline: "Asked before",
      accent: "every subscription.",
      items: [
        {
          q: "What counts as long-form and short-form?",
          a: "Long-form is up to 15 minutes: YouTube videos, trainings, webinar cuts. Short-form is under 60 seconds: Reels, Shorts, TikTok. Your plan sets the monthly count of each.",
        },
        {
          q: "How fast do edits come back?",
          a: "Standard turnaround is 2 to 3 business days per video. Scale subscribers sit in the priority queue and go first.",
        },
        {
          q: "What does unlimited revisions actually mean?",
          a: "You ask, we revise, until you approve it. Every plan, every video, no revision caps and no upcharges.",
        },
        {
          q: "Can I cancel anytime?",
          a: "Yes. No contracts on any plan. You keep everything already delivered.",
        },
        {
          q: "Do you know HighLevel content or just editing?",
          a: "Both. The team edits HighLevel content daily, so funnels, snapshots, and dashboards get captioned correctly without you writing a glossary.",
        },
      ],
    },
  },

  about: {
    hero: {
      chip: "About",
      headline: "The original",
      accent: "HighLevel-only video studio.",
      lede: "One niche, one stack, 800+ HighLevel teams served. This page is the why.",
    },
    story: {
      chip: "The category",
      headline: "Why HighLevel-only",
      accent: "is the moat.",
      paragraphs: [
        "A generalist studio learns your product on your budget. Every hour they spend understanding what a snapshot is, you pay for. We made the opposite bet: one ecosystem, learned once, compounding across every project since.",
        "That bet changed the economics. Premade videos exist because the platform is the same under every brand, so the production can be shared and the price can drop. Custom work starts at the interesting part, your positioning, instead of the basics. Editing gets captions right the first time.",
        "The result is a studio where the client never teaches the vendor. You talk about your market and your angle. We already speak the rest.",
      ],
    },
    founder: {
      chip: "Founder",
      /* DRAFT: same standing note as the homepage founder line */
      quote:
        "Video is not marketing decoration. For a SaaS reseller it is sales infrastructure: the demo that runs while you sleep, the onboarding that scales without headcount. That is the standard we build to.",
    },
    clients: {
      chip: "Clients",
      headline: "Trusted by the founders",
      accent: "building on HighLevel.",
    },
    entity: {
      chip: "The company",
      headline: "One studio,",
      accent: "openly built.",
      lines: [
        "GHL Video is a brand of Vidiosa LLC, alongside growX and socialX.",
        "GHL Video is not affiliated with or endorsed by GoHighLevel Inc. We build for the ecosystem as an independent studio.",
      ],
    },
  },

  contact: {
    hero: {
      chip: "Contact",
      headline: "Book the call.",
      accent: "Leave with a plan.",
      lede: "Fifteen minutes. You talk through what you sell and what you need; you leave with the right format and the real price.",
    },
    callPoints: [
      { title: "Show up", line: "No prep needed. Bring your SaaS and your goal." },
      { title: "Scope", line: "We map the format that fits: premade, custom, or editing." },
      { title: "Decide", line: "You get the price on the call. No follow-up sequence." },
    ],
    booking: {
      chip: "Pick a time",
      /* LeadConnector calendar embed replaces this slot at launch */
      note: "The booking calendar connects here at launch.",
    },
    fallback: {
      headline: "Not a call person?",
      line: "Email works. A human replies within 24 hours.",
    },
  },

  work: {
    hero: {
      chip: "Our work",
      headline: "Made for platforms",
      accent: "like yours.",
      lede: "A slice of recent work across premade, custom, and editing. Every piece below plays; click any frame for the full cut.",
    },
    /* PLACEHOLDER set: the same five CDN clips as the homepage. The
     * full portfolio drops in here when Shariful sends the final list. */
    note: "The full portfolio is being migrated. These pieces are the current sample set.",
  },
} as const;

export const oldVideoTypes = [
  "Short Explainer",
  "Explainer",
  "Demo",
  "Feature Animation",
  "Marketing",
] as const;
export type OldVideoType = (typeof oldVideoTypes)[number];

export type OldVideo = {
  slug: string;
  title: string;
  subtitle?: string;
  type: OldVideoType;
  price: number;
  /* the real products embed from Wistia; the short explainers are mp4 */
  wistiaId?: string;
  preview?: string | null;
  poster: string | null;
  /* feature animation ships as bundles, not single clips */
  packCount?: number;
  orderUrl: string;
};

/* The classic library: real videos, prices, and order links scraped
 * verbatim from the pre-2026 ghlvideo.com. Mostly produced before
 * HighLevel's 2026 refresh, still brandable and sold at the old prices. */
export const oldVideos: OldVideo[] = [
  {
    slug: "ai-employee",
    title: "AI Employee",
    type: "Short Explainer",
    price: 195,
    preview: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69245a77e7b09410bd133ff1.mp4",
    poster: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/692465f32a7927601442fefa.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "conversational-ai",
    title: "Conversational AI",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77e4747c43d6c3c90a.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692464a546b2e70b577e712f.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "voice-ai",
    title: "Voice AI",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77a6fefe33ec381509.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692466fee4747cbfe4c5205d.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "content-ai",
    title: "Content AI",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77c61b11848f07eabe.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692468ffdb7e0bd7c2cd27bc.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "all-in-one-inbox",
    title: "All-in-one Inbox",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924575646b2e7aacf7d02c4.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692469ca2a79272f77437347.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "opportunity-pipeline",
    title: "Opportunity Pipeline",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692457c1e4747c7804c38571.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246a8ae4747c9786c5acdb.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "automation-builder",
    title: "Automation Builder",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77eb10142d5ef2f43e.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246b69db7e0b1492cd948d.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "reputation-manager",
    title: "Reputation Manager",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77c61b1109b807eabd.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246c7b2a792753cf43edce.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "email-builder",
    title: "Email Builder",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77e7b09463ed133ff2.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246d6ce4747c7665c60b29.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "contact-management",
    title: "Contact Management",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77e4747cc227c3c914.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246e6637de76e16cdaf7dd.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "calender-booking",
    title: "Calender Booking",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77eb1014bee9f2f43f.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246f14c61b1148ac0a6a46.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "two-way-texting",
    title: "Two-Way-Texting",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77a6fefe3433381508.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69246faae7b0944e5615e569.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "social-media-planner",
    title: "Social Media Planner",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77e7b09458aa133ff3.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924708fe4747c2a64c6725f.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "call-tracking-recording",
    title: "Call Tracking & Recording",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77a5fc8de865c15246.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69247153e7b094be04163a8a.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "payment-invoicing",
    title: "Payment & Invoicing",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77db7e0b067ccb886d.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924722feb10142442f5ec1a.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "missed-call-text-back",
    title: "Missed Call Text back",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692457c1eb1014870df2a5fc.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924738feb10141a3ef617af.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "mobile-app",
    title: "Mobile App",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77a5fc8d78bdc15247.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692474d846b2e7c69880b607.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "live-chat-widget",
    title: "Live Chat Widget",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77e7b094693e133ff4.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924758be7b0944e0316cec6.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "membership",
    title: "Membership",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a7846b2e7165f7d57ed.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692476e146b2e71f2480fa0b.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "power-dialer",
    title: "Power Dialer",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a772a7927b97c41be11.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692477eddb7e0b52a9cf3ead.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "reporting",
    title: "Reporting",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77a5fc8d02f1c15241.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692478dee4747cb6b4c79b3e.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "forms-surveys",
    title: "Forms & Surveys",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69245a77c61b1140f407eabc.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/692479bca6fefe107e3c1e93.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "comparison-video",
    title: "Comparison Video",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924573cdb7e0b0562cb32ac.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69248052a5fc8d2701c6502a.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "everything-in-one-place",
    title: "Everything in One Place",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924573ddb7e0bee2dcb32b6.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/69248165a6fefea3d93d3bdc.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "all-in-one-platform",
    title: "All in One Platform",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924573d2a79270107416550.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6924826be7b094452518a887.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "funnel-website-builder",
    title: "Funnel & Website Builder",
    type: "Short Explainer",
    price: 195,
    preview: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6989e2a5634d0ac17424c13c.mp4",
    poster: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6989e2b37305aad971f1d1dd.png",
    orderUrl: "https://order.ghlvideo.com/short-explainer-videos",
  },
  {
    slug: "explainer-v1",
    title: "Explainer V1",
    subtitle: "All-in-one platform overview",
    type: "Explainer",
    price: 395,
    wistiaId: "trdqye7g5q",
    poster: "https://embed-ssl.wistia.com/deliveries/2804d0c1b80062a75c5d54de622c9e9a.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/explainer-v1",
  },
  {
    slug: "explainer-v2",
    title: "Explainer V2",
    subtitle: "AI agent and AI employee",
    type: "Explainer",
    price: 395,
    wistiaId: "gq4rntluy4",
    poster: "https://embed-ssl.wistia.com/deliveries/ff1732dc84ecb4ebff55d486acb0e05942e69bcb.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/explainer-v2",
  },
  {
    slug: "explainer-v3",
    title: "Explainer V3",
    subtitle: "Reputation management",
    type: "Explainer",
    price: 395,
    wistiaId: "rvgcfdknv0",
    poster: "https://embed-ssl.wistia.com/deliveries/9c1761630837e74003b299dfb4c5bb4f.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/explainer-v3",
  },
  {
    slug: "explainer-v4",
    title: "Explainer V4",
    subtitle: "Social planner",
    type: "Explainer",
    price: 395,
    wistiaId: "9v0ca9v97y",
    poster: "https://embed-ssl.wistia.com/deliveries/2e7502573dedf87ad08321d39571c611.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/explainer-v4",
  },
  {
    slug: "explainer-v5",
    title: "Explainer V5",
    subtitle: "Never-ending outreach machine",
    type: "Explainer",
    price: 395,
    wistiaId: "8uhjekncqh",
    poster: "https://embed-ssl.wistia.com/deliveries/266e4085228e4583a5b49f7178c19478.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/explainer-v5",
  },
  {
    slug: "explainer-v6",
    title: "Explainer V6",
    subtitle: "Complete platform overview",
    type: "Explainer",
    price: 395,
    wistiaId: "nyv9u91be2",
    poster: "https://embed-ssl.wistia.com/deliveries/63b213ac1651cc07ce3b26cc0b8fc17e.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/explainer-v6",
  },
  {
    slug: "demo-v1",
    title: "HighLevel Demo V1",
    subtitle: "Spokesperson led",
    type: "Demo",
    price: 495,
    wistiaId: "6mji3qgjed",
    poster: "https://embed-ssl.wistia.com/deliveries/a6901634240c08a0dbc820ffe6796daab414b057.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/demo-v1",
  },
  {
    slug: "demo-v2",
    title: "HighLevel Demo V2",
    subtitle: "Motion graphic, no AI",
    type: "Demo",
    price: 495,
    wistiaId: "5rltwdyq6h",
    poster: "https://embed-ssl.wistia.com/deliveries/192fb8589c66bb490a277524bd075e56.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/demo-v2",
  },
  {
    slug: "demo-v3-6708",
    title: "HighLevel Demo V3",
    subtitle: "AI capabilities, updated",
    type: "Demo",
    price: 995,
    wistiaId: "kvxz5zjd6j",
    poster: "https://embed-ssl.wistia.com/deliveries/2ef47e87e0771057f43fcccc95946f07.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/demo-v3-6708",
  },
  {
    slug: "marketing-1",
    title: "Social Media Scheduler",
    subtitle: "Marketing clip 01",
    type: "Marketing",
    price: 97,
    wistiaId: "nbi34xekmw",
    poster: "https://embed-ssl.wistia.com/deliveries/e17cd1f16c5fcd9c9ef4a6c89596a34dda8289ed.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-2",
    title: "Content AI",
    subtitle: "Marketing clip 02",
    type: "Marketing",
    price: 97,
    wistiaId: "s2wgkvxnfq",
    poster: "https://embed-ssl.wistia.com/deliveries/e4e5b01da18be2471df0825ca4328ad9847e6a9f.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-3",
    title: "Email Builder",
    subtitle: "Marketing clip 03",
    type: "Marketing",
    price: 97,
    wistiaId: "3r3fqinoul",
    poster: "https://embed-ssl.wistia.com/deliveries/75e51a08d0f1ae2b6cc49bd62f33d28e145eb33f.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-4",
    title: "Website Builder",
    subtitle: "Marketing clip 04",
    type: "Marketing",
    price: 97,
    wistiaId: "817t6o0tea",
    poster: "https://embed-ssl.wistia.com/deliveries/a7066f3584d89d2bdf19cd01aca848ea912ef3d6.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-5",
    title: "Memberships",
    subtitle: "Marketing clip 05",
    type: "Marketing",
    price: 97,
    wistiaId: "2v4kk70uvu",
    poster: "https://embed-ssl.wistia.com/deliveries/89c02ddeb1961bff83aa60275570d538bb7d0fd0.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-6",
    title: "Workflow Automation",
    subtitle: "Marketing clip 06",
    type: "Marketing",
    price: 97,
    wistiaId: "oeoi4dio20",
    poster: "https://embed-ssl.wistia.com/deliveries/c2fadd3928a0bc812bdfc35fa9ecacf79dea7321.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-7",
    title: "Reporting",
    subtitle: "Marketing clip 07",
    type: "Marketing",
    price: 97,
    wistiaId: "6uw4jp0vhe",
    poster: "https://embed-ssl.wistia.com/deliveries/037511fc16dc3c5c77036441680ad7b04ec95117.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-8",
    title: "Unified Inbox",
    subtitle: "Marketing clip 08",
    type: "Marketing",
    price: 97,
    wistiaId: "ovahf5ewua",
    poster: "https://embed-ssl.wistia.com/deliveries/ecc8bffb124417fc8f5f6687f8dca2983cb8a44a.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-9",
    title: "Missed Call Text Back",
    subtitle: "Marketing clip 09",
    type: "Marketing",
    price: 97,
    wistiaId: "2ct1tot3ef",
    poster: "https://embed-ssl.wistia.com/deliveries/46a88a1e8c0f7a306709eb4113bdb0f0b6ff7356.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-10",
    title: "Calendars",
    subtitle: "Marketing clip 10",
    type: "Marketing",
    price: 97,
    wistiaId: "nc774vi0yh",
    poster: "https://embed-ssl.wistia.com/deliveries/104b4b5437e9ab4a558b6132de685ee2e9796004.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-11",
    title: "Missed Call Alerts",
    subtitle: "Marketing clip 11",
    type: "Marketing",
    price: 97,
    wistiaId: "p5i16fiy6p",
    poster: "https://embed-ssl.wistia.com/deliveries/f9539298ae2f085787f562f0b8ec9e8e26a313e0.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-12",
    title: "Opportunity Pipeline",
    subtitle: "Marketing clip 12",
    type: "Marketing",
    price: 97,
    wistiaId: "suma3wivbs",
    poster: "https://embed-ssl.wistia.com/deliveries/6fbe9c7f1ebbdac5b0d69dadb6a0b76196bcddea.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-13",
    title: "Invoice",
    subtitle: "Marketing clip 13",
    type: "Marketing",
    price: 97,
    wistiaId: "arrmpjo06f",
    poster: "https://embed-ssl.wistia.com/deliveries/a4338ed8872d8cf1f80c5c3f4b766d8638b9a512.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-14",
    title: "Automated Review System",
    subtitle: "Marketing clip 14",
    type: "Marketing",
    price: 97,
    wistiaId: "se0l38otjw",
    poster: "https://embed-ssl.wistia.com/deliveries/648d6de26ce9be062a0c6e917ce9c13f5f586aa3.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-15",
    title: "AB Testing",
    subtitle: "Marketing clip 15",
    type: "Marketing",
    price: 97,
    wistiaId: "rhygf5ydrb",
    poster: "https://embed-ssl.wistia.com/deliveries/a5eae6e9ad97508c4ba9c15a14f9f28ec29fb48c.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-16",
    title: "Automated Follow-up Sequences",
    subtitle: "Marketing clip 16",
    type: "Marketing",
    price: 97,
    wistiaId: "b3shffthjf",
    poster: "https://embed-ssl.wistia.com/deliveries/7a8b9a1c739acdb4d34069968550895f8c21ead3.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-17",
    title: "Surveys",
    subtitle: "Marketing clip 17",
    type: "Marketing",
    price: 97,
    wistiaId: "lo295ze83h",
    poster: "https://embed-ssl.wistia.com/deliveries/1c082490a2b694de31cab49c381b06e02cd06f30.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-18",
    title: "Cloud Ecosystem",
    subtitle: "Marketing clip 18",
    type: "Marketing",
    price: 97,
    wistiaId: "5w5n8nm1lf",
    poster: "https://embed-ssl.wistia.com/deliveries/74e0f679185fc9ae6ab9932bf36e7638bab24d2d.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-19",
    title: "Reputation Management",
    subtitle: "Marketing clip 19",
    type: "Marketing",
    price: 97,
    wistiaId: "ii7box3zo6",
    poster: "https://embed-ssl.wistia.com/deliveries/0f0bf3e602dc589ab37a277b1e333c38779fce61.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-20",
    title: "Two-Way Text Messaging",
    subtitle: "Marketing clip 20",
    type: "Marketing",
    price: 97,
    wistiaId: "ljci4puk7y",
    poster: "https://embed-ssl.wistia.com/deliveries/20376156a2ff589867c2469834231743451ba2a2.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "marketing-21",
    title: "Workflows and Automation",
    subtitle: "Marketing clip 21",
    type: "Marketing",
    price: 97,
    wistiaId: "w7o6w939hc",
    poster: "https://embed-ssl.wistia.com/deliveries/dfe5db3673aa7a82bb936198c1636a22ef6d7aae.jpg?image_crop_resized=960x540",
    orderUrl: "https://order.ghlvideo.com/marketing-video",
  },
  {
    slug: "feature-animations-7",
    title: "Feature Animation Pack, 7",
    subtitle: "7 platform feature animations, brandable",
    type: "Feature Animation",
    price: 495,
    poster: null,
    packCount: 7,
    orderUrl: "https://order.ghlvideo.com/feature-animations-7",
  },
  {
    slug: "feature-animations-15",
    title: "Feature Animation Pack, 15",
    subtitle: "15 platform feature animations, brandable",
    type: "Feature Animation",
    price: 895,
    poster: null,
    packCount: 15,
    orderUrl: "https://order.ghlvideo.com/feature-animations-15",
  },
  {
    slug: "feature-animations-23",
    title: "Feature Animation Pack, 23",
    subtitle: "23 platform feature animations, brandable",
    type: "Feature Animation",
    price: 1295,
    poster: null,
    packCount: 23,
    orderUrl: "https://order.ghlvideo.com/feature-animations-23",
  },
];

/* ---------------------------------------------------------------- */
/* Feature animations: the classic 23-feature library, each rendered
 * in two versions the old site let buyers toggle between: a clean
 * "Simplified UI" cut and a "Real UI" cut on the actual dashboard.
 * Sold only inside the feature-animation bundles, so these are
 * previews, not single SKUs. mp4 on the LeadConnector CDN. */
export type FeatureAnimation = {
  slug: string;
  name: string;
  simplified: string;
  real: string | null;
  thumbSimplified: string;
  thumbReal: string;
};

export const featureAnimations: FeatureAnimation[] = [
  {
    slug: "pipeline",
    name: "Pipeline",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d1cd1311f63757bfe3af.mp4",
    real: null,
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d29318ecce54fa2247d1.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d3321f68d11d0b1cb40f.png",
  },
  {
    slug: "unified-inbox",
    name: "Unified Inbox",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d4f276757771593abbe3.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d48f18eccecb6122aa58.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d5e03c458e71fed29594.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d58610efd654325a8221.png",
  },
  {
    slug: "2-way-texting",
    name: "2 Way texting",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb3a11aab9359e91c4b8c.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb36d6f6d4c0d95529291.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb5d90a51c877f5c5c14c.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb43697c0513daac96fc6.png",
  },
  {
    slug: "ai-employee",
    name: "AI Employee",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb4861aab93b9741c6636.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb47897c05152c8c97688.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb54cd80f5c34a0371d58.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb4cfd80f5c52b637102b.png",
  },
  {
    slug: "workflows-builder",
    name: "Workflows Builder",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb6542e1faa20cfb5de11.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb6542e1faa20cfb5de11.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb6d5006d90678d003794.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb74a5c1881a164e3bf70.png",
  },
  {
    slug: "calendar-booking",
    name: "Calendar Booking",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb7ac6f6d4c6423530fa2.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb7977b02cf824c8b7a76.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb87ed80f5c689c3783a2.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb7f56f6d4c28eb531b24.png",
  },
  {
    slug: "call-tracking-and-recording",
    name: "Call Tracking & Recording",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9057b02cf37428ba870.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb8e77b02cf061f8ba474.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9887b02cfb9cb8bbc01.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb93e97c0514677ca0a7d.png",
  },
  {
    slug: "contact-management",
    name: "Contact Management",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9ca97c051da48ca22cc.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9c26f6d4c806b5357f0.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbe2c1aab93057e1dc71f.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbdea6f6d4c3a5053f592.png",
  },
  {
    slug: "content-ai",
    name: "Content AI",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9da5c1881aaa8e418f1.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9e297c051d921ca26e3.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbe70d80f5ced6b3877ed.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbeb2d80f5cdb6e388168.png",
  },
  {
    slug: "conversation-ai",
    name: "Conversation AI",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9fb1aab938cb61d1862.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cb9f10a51c81cd6c641d8.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbff17b02cfa2508cb7db.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbf7e006d90836c0174a4.png",
  },
  {
    slug: "email-campaign-builder",
    name: "Email Campaign Builder",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba0c006d90378200a01e.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba1497c0510fe5ca2cc4.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc13e97c051bceecb4a6a.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc0b9006d903cbe01b31e.png",
  },
  {
    slug: "forms-and-surveys",
    name: "Forms & Surveys",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba451aab9318711d1f78.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba3cd80f5cae9c37c102.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc1f197c051d902cb6d80.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc1b25c188186ace54f6f.png",
  },
  {
    slug: "live-chat-widget",
    name: "Live Chat Widget",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba707b02cf70298bd69e.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba66d80f5c236137c699.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc27d1aab9322d31e869e.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc31e006d90de1902149b.png",
  },
  {
    slug: "membership",
    name: "Membership",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbaae97c0511f7eca3eb0.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cba9e97c05194a9ca3cda.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc377006d9056830229e0.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc3f21aab93c4f61ec863.png",
  },
  {
    slug: "missed-call-text-back",
    name: "Missed call text back",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbace2e1faa6f19b67495.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbade006d9017ab00bb42.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc5022e1faa6f64b81f60.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc4441aab9330291ed66b.png",
  },
  {
    slug: "mobile-apps",
    name: "Mobile Apps",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbb1497c05143bfca4e63.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbb076f6d4cb87553807e.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc53c1aab93afef1efc16.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc58a006d9039e5027a7b.png",
  },
  {
    slug: "payments-and-invoicing",
    name: "Payments & Invoicing",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbb335c1881336ce44bae.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbb415c1881d7dfe44d24.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc6ad6f6d4c9afe557692.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc65a97c051e4eecc293d.png",
  },
  {
    slug: "power-dialer",
    name: "Power Dialer",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbbae5c188128dce45bd6.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbb77ac5927ae624a27b6.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc75a0a51c8b37ec875db.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc7a6006d9035bc02d443.png",
  },
  {
    slug: "reporting",
    name: "Reporting",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbc18d80f5cb2d7380b94.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbc301aab930c241d6ca0.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc8315c1881547de65b01.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc7e9006d9045ed02e055.png",
  },
  {
    slug: "reputation-management",
    name: "Reputation Management",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbc571aab93674f1d7197.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbc467b02cf6ede8c214f.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc89e006d909d1202faeb.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc8df0beb166f08628698.png",
  },
  {
    slug: "social-media-planner",
    name: "Social Media Planner",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbcb2ac592732e04a5daf.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbcbd6f6d4c01c053c789.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cca03ac592708c74c93e9.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cc9415c18812c5de68dfe.png",
  },
  {
    slug: "voice-ai",
    name: "Voice Ai",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbd056f6d4c8b9153d288.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690cbcf56f6d4c2b9a53d0c1.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690ccbab2e1faa1ff6b92dd6.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/690ccb560a51c8f279c92212.png",
  },
  {
    slug: "funnel-and-website-builder",
    name: "Funnel and Website Builder",
    simplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d76118ecce2bdc235772.mp4",
    real: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d7871fd8276257bcb944.mp4",
    thumbSimplified: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d8aa7675773d563b9c1a.png",
    thumbReal: "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/6980d82918eccee50223866f.png",
  },
];

/* ---------------------------------------------------------------- */
/* The Complete Video Stack: the everything bundle, 53 branded videos
 * across five formats at one price. A pack tab of its own, sold on
 * order.ghlvideo.com/highlevel-video-stack. Per-format "value" figures
 * are the anchor the live sales page frames the $1,995 against. */
export type StackFormat = {
  name: string;
  count: number;
  value: number;
  sampleType: OldVideoType;
};

/* ---------------------------------------------------------------- */
/* HighLevel x Vidiosa: our collaborations with HighLevel. We produce a
 * video for HighLevel; they release a white-label cut for resellers and
 * let us brand it for any customer who asks. Every such project lives
 * here. For now, one: the Full Platform Pitch, in six versions. Each
 * version has its own preview (mp4 or Wistia); Dutch and Spanish have no
 * example yet. Prices and CTAs are verbatim from the live page. */
export type CollabVersion = {
  slug: string;
  name: string;
  price: number; // 0 = free download
  cta: "buy" | "download";
  url: string;
  wistiaId: string | null; // preview; null = no example yet
  note: string;
};
export type CollabProject = {
  slug: string;
  name: string;
  tagline: string;
  mainPreview: string; // mp4 of the HighLevel original
  versions: CollabVersion[];
};

export const collab = {
  slug: "collab",
  tabLabel: "HighLevel x GHL Video",
  blurb:
    "Videos we produced with HighLevel. They ship a free white-label cut; we brand it for any SaaS that asks.",
  projects: [
    {
      slug: "full-platform-pitch",
      name: "Full Platform Pitch",
      tagline:
        "We produced HighLevel's own full-platform pitch. They released a white-label cut for their resellers, and gave us permission to brand it for any SaaS that asks. Watch the original, then pick your version.",
      mainPreview:
        "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a56f37c1a0f04805029e049.mp4",
      versions: [
        {
          slug: "white-label",
          name: "White-Label Version",
          price: 0,
          cta: "download",
          url: "https://www.playbook.com/s/ghlprojects/CLTewo4gtHBzHNCZxRKDvCkn",
          wistiaId: "7dc2746xn7",
          note: "HighLevel's white-label cut. Free to download and use.",
        },
        {
          slug: "logo-only",
          name: "Logo Only",
          price: 97,
          cta: "buy",
          url: "https://order.ghlvideo.com/hl-full-pitch-video",
          wistiaId: "pyvywzfmao",
          note: "Your logo dropped into the dashboard.",
        },
        {
          slug: "complete-brand",
          name: "Complete Brand Customization",
          price: 495,
          cta: "buy",
          url: "https://order.ghlvideo.com/hl-full-pitch-video",
          wistiaId: "x8drp1z4u8",
          note: "Your logo, colors, and brand name in the voiceover.",
        },
        {
          slug: "uk-accent",
          name: "UK / Australian Accent",
          price: 595,
          cta: "buy",
          url: "https://order.ghlvideo.com/hl-full-pitch-video",
          wistiaId: "yon4baclgn",
          note: "Full rebrand, re-voiced in a UK or Australian accent.",
        },
        {
          slug: "dutch",
          name: "Dutch Edition",
          price: 695,
          cta: "buy",
          url: "https://order.ghlvideo.com/hl-full-pitch-video",
          wistiaId: null,
          note: "Full rebrand, localized in Dutch.",
        },
        {
          slug: "spanish",
          name: "Spanish Edition",
          price: 695,
          cta: "buy",
          url: "https://order.ghlvideo.com/hl-full-pitch-video",
          wistiaId: null,
          note: "Full rebrand, localized in Spanish.",
        },
      ],
    },
  ] as CollabProject[],
};

/* ---------------------------------------------------------------- */
/* Video bundles, three ways: New (newest releases only), Classic (the
 * pre-2026 catalog, at reduced prices) and Mix (best of both). Each item
 * names the library it comes from so a Mix bundle reads clearly. FLAG:
 * prices, counts, and order SKUs are a design proposal, easy to change.
 * Anchor prices are the summed a-la-carte value of the contents. */
export type BundleLibrary = "New Library" | "Classic Library";
export type BundleItem = { label: string; library: BundleLibrary };
export type BundleTier = {
  slug: string;
  name: string;
  price: number;
  anchorPrice: number;
  deliveryDays: number;
  featured: boolean;
  items: BundleItem[];
  orderUrl: string;
};
export type BundleCategory = {
  slug: string;
  name: string;
  blurb: string;
  tiers: BundleTier[];
};

const NEW: BundleLibrary = "New Library";
const CLASSIC: BundleLibrary = "Classic Library";

export const bundleCategories: BundleCategory[] = [
  {
    slug: "new",
    name: "New Video Bundle",
    blurb:
      "Only our newest releases. Small and high-value for now; it grows as the new library does.",
    tiers: [
      {
        slug: "new-essential",
        name: "Essential",
        price: 995,
        anchorPrice: 1380,
        deliveryDays: 7,
        featured: false,
        orderUrl: "https://order.ghlvideo.com/ghlv-new-essential",
        items: [
          { label: "1× Explainer", library: NEW },
          { label: "2× Short Explainer", library: NEW },
          { label: "Full Platform Pitch", library: NEW },
        ],
      },
      {
        slug: "new-growth",
        name: "Growth",
        price: 1495,
        anchorPrice: 2265,
        deliveryDays: 10,
        featured: true,
        orderUrl: "https://order.ghlvideo.com/ghlv-new-growth",
        items: [
          { label: "1× Explainer", library: NEW },
          { label: "4× Short Explainer", library: NEW },
          { label: "1× Demo", library: NEW },
          { label: "Full Platform Pitch", library: NEW },
        ],
      },
    ],
  },
  {
    slug: "classic",
    name: "Classic Library Bundle",
    blurb:
      "The full pre-2026 catalog, at reduced prices. Still brandable, still yours.",
    tiers: [
      {
        slug: "classic-starter",
        name: "Starter",
        price: 795,
        anchorPrice: 1570,
        deliveryDays: 7,
        featured: false,
        orderUrl: "https://order.ghlvideo.com/ghlv-bundle1",
        items: [
          { label: "1× Explainer", library: CLASSIC },
          { label: "1× Short Explainer", library: CLASSIC },
          { label: "1× Demo", library: CLASSIC },
          { label: "5× Marketing", library: CLASSIC },
        ],
      },
      {
        slug: "classic-growth",
        name: "Growth",
        price: 1355,
        anchorPrice: 4225,
        deliveryDays: 10,
        featured: false,
        orderUrl: "https://order.ghlvideo.com/ghlv-bundle2",
        items: [
          { label: "2× Explainer", library: CLASSIC },
          { label: "5× Short Explainer", library: CLASSIC },
          { label: "1× Demo (incl. V3)", library: CLASSIC },
          { label: "10× Marketing", library: CLASSIC },
          { label: "7× Feature Animations", library: CLASSIC },
        ],
      },
      {
        slug: "classic-pro",
        name: "Pro",
        price: 1595,
        anchorPrice: 7370,
        deliveryDays: 10,
        featured: true,
        orderUrl: "https://order.ghlvideo.com/ghlv-bundle3",
        items: [
          { label: "4× Explainer", library: CLASSIC },
          { label: "10× Short Explainer", library: CLASSIC },
          { label: "2× Demo (incl. V3)", library: CLASSIC },
          { label: "15× Marketing", library: CLASSIC },
          { label: "15× Feature Animations", library: CLASSIC },
        ],
      },
      {
        slug: "classic-complete",
        name: "Complete",
        price: 2395,
        anchorPrice: 12755,
        deliveryDays: 14,
        featured: false,
        orderUrl: "https://order.ghlvideo.com/ghlv-bundle4",
        items: [
          { label: "All 6× Explainer", library: CLASSIC },
          { label: "All 26× Short Explainer", library: CLASSIC },
          { label: "All 3× Demo", library: CLASSIC },
          { label: "All 21× Marketing", library: CLASSIC },
          { label: "All 23× Feature Animations", library: CLASSIC },
        ],
      },
    ],
  },
  {
    slug: "mix",
    name: "Mix Bundle",
    blurb:
      "The best of both. Our newest videos paired with the classic library in one order.",
    tiers: [
      {
        slug: "mix-core",
        name: "Mix",
        price: 2695,
        anchorPrice: 6350,
        deliveryDays: 10,
        featured: true,
        orderUrl: "https://order.ghlvideo.com/ghlv-mix1",
        items: [
          { label: "1× Explainer", library: NEW },
          { label: "Full Platform Pitch", library: NEW },
          { label: "3× Explainer", library: CLASSIC },
          { label: "8× Short Explainer", library: CLASSIC },
          { label: "1× Demo (incl. V3)", library: CLASSIC },
          { label: "10× Marketing", library: CLASSIC },
          { label: "10× Feature Animations", library: CLASSIC },
        ],
      },
      {
        slug: "mix-pro",
        name: "Mix Pro",
        price: 3495,
        anchorPrice: 10025,
        deliveryDays: 14,
        featured: false,
        orderUrl: "https://order.ghlvideo.com/ghlv-mix2",
        items: [
          { label: "1× Explainer", library: NEW },
          { label: "4× Short Explainer", library: NEW },
          { label: "1× Demo", library: NEW },
          { label: "Full Platform Pitch", library: NEW },
          { label: "4× Explainer", library: CLASSIC },
          { label: "12× Short Explainer", library: CLASSIC },
          { label: "2× Demo (incl. V3)", library: CLASSIC },
          { label: "15× Marketing", library: CLASSIC },
          { label: "15× Feature Animations", library: CLASSIC },
        ],
      },
    ],
  },
];

export const videoStack = {
  slug: "stack",
  name: "Complete Video Stack",
  tagline:
    "The everything bundle: 53 custom-branded videos mixing our newest releases with the classic library, across every format your HighLevel SaaS needs. One order, live in 10 days.",
  price: 2495,
  anchorPrice: 55000,
  totalCount: 53,
  deliveryDays: 10,
  orderUrl: "https://order.ghlvideo.com/highlevel-video-stack",
  preview:
    "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/69ac022b618c8d761f4a667b.mp4",
  formats: [
    { name: "Explainer Videos", count: 2, value: 5000, sampleType: "Explainer" },
    { name: "Demo Video", count: 1, value: 7000, sampleType: "Demo" },
    { name: "Short Explainer Videos", count: 20, value: 20000, sampleType: "Short Explainer" },
    { name: "Marketing Videos", count: 15, value: 15000, sampleType: "Marketing" },
    { name: "Feature Animations", count: 15, value: 8000, sampleType: "Feature Animation" },
  ] as StackFormat[],
};
