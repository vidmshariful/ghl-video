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
} as const;

export const posters = {
  reel: "/posters/clip-1.jpg",
  featured: "/posters/clip-2.jpg",
  sampleA: "/posters/clip-3.jpg",
  sampleB: "/posters/clip-4.jpg",
  sampleC: "/posters/clip-5.jpg",
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
 * with no layout change. Previews cycle the three sample clips. */
export const premadeVideos: PremadeVideo[] = Array.from({ length: 10 }).map(
  (_, i) => {
    const cycle = [
      { preview: clips.sampleA, poster: posters.sampleA },
      { preview: clips.sampleB, poster: posters.sampleB },
      { preview: clips.sampleC, poster: posters.sampleC },
    ][i % 3];
    return {
      slug: `video-${i + 1}`,
      title: `Premade Video ${i + 1}`,
      purpose: "One line on what this video is for",
      price: premadePrice,
      preview: cycle.preview,
      poster: cycle.poster,
      orderUrl: `https://order.ghlvideo.com/video-${i + 1}`,
    };
  },
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
        mediaKey: "sampleC",
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
    statement:
      "Your prospects judge your SaaS before they ever try it. A Loom demo and a DIY explainer tell them everything they need to know, and not in your favor.",
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
    /* One featured piece plus two supporting clips, all hover-play.
     * Client and format captions are placeholders until the real
     * featured set is chosen. Swap here only. */
    pieces: [
      {
        src: clips.featured,
        poster: posters.featured,
        client: "NeoLuxLabs",
        format: "Onboarding Series",
        /* ambient loop window comes from clipWindows.featured */
        startAt: clipWindows.featured!.startAt,
        endAt: clipWindows.featured!.endAt,
      },
      {
        src: clips.sampleA,
        poster: posters.sampleA,
        client: "Emma.io",
        format: "Platform Demo",
        startAt: clipWindows.sampleA!.startAt,
        endAt: clipWindows.sampleA!.endAt,
      },
      {
        src: clips.sampleB,
        poster: posters.sampleB,
        client: "AI Clinic Assist",
        format: "Explainer",
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

/* NOTE: premade pricing is per SKU (premadeVideos[].price). The launch
 * set ships at $495 each; Shariful's final price model may raise some
 * SKUs, so every card and CTA reads its own price from the config. */
export const pages = {
  premade: {
    hero: {
      chip: "Premade Videos",
      headline: "Professional HighLevel videos,",
      accent: "branded to your SaaS.",
      lede: "Pick from the launch set. We rebrand every frame to your platform: your logo, your dashboard theme, your voiceover. Delivered in 5 to 7 days.",
      priceSignal: "From $495 per video",
    },
    grid: {
      chip: "The launch set",
      headline: "Ten videos,",
      accent: "ready to carry your brand.",
      intro:
        "Every preview below is the actual video. What changes is the branding: yours replaces ours on every frame.",
    },
    included: {
      chip: "What's included",
      headline: "Every premade ships",
      accent: "complete.",
      items: [
        "Your logo and brand colors on every frame",
        "Dashboard theme matched to your SaaS",
        "Professional voiceover in your choice of accent",
        "Full commercial rights, no attribution",
        "Delivered in 5 to 7 days, ready to publish",
      ],
    },
    how: {
      chip: "How it works",
      headline: "Order today,",
      accent: "publish next week.",
      steps: [
        {
          title: "Order",
          line: "Pick the video and check out. Two clicks, no call required.",
        },
        {
          title: "Submit branding",
          line: "Send your logo, colors, and dashboard theme through the onboarding form.",
        },
        {
          title: "Receive",
          line: "Your branded video lands in 5 to 7 days with full commercial rights.",
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
          q: "How custom does a premade get?",
          a: "Your logo, your brand colors, your dashboard theme, and your voiceover. The structure and script stay fixed, which is exactly why it ships in days instead of weeks.",
        },
        {
          q: "What if I need a different script or format?",
          a: "That is custom production. Starting prices are published on the custom page, and a quote takes one short form.",
        },
        {
          q: "How do I send my branding?",
          a: "After checkout you get a short onboarding form: logo, colors, dashboard theme, and voiceover preference. Five minutes, then we take over.",
        },
        {
          q: "What does delivery look like?",
          a: "A download link with the final video in full resolution, plus the versions you need for ads and social. Delivered in 5 to 7 days from receiving your branding.",
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
