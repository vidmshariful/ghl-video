import { aiPackClips } from "./premade";

/* ------------------------------------------------------------------ */
/* Homepage content                                                     */
/* ------------------------------------------------------------------ */

/* The live Google reviews for GHL Video (5.00, 17 reviews). */
export const googleReviewsUrl =
  "https://www.google.com/search?q=ghl+video#lrd=0x3755c3a3394f03b9:0x1f310bcbd31aa084,1";

/* Trust bar logo wall: the three named clients are real; the rest are
 * PLACEHOLDER marks until Shariful clears the real client logos. */
/* Real client logos in public/logos (rendered as uniform silhouettes in
 * the marquee, full colour on hover). The full set also composes the
 * client-wall collage on the homepage. */
export const trustLogos = Array.from(
  { length: 40 },
  (_, i) => `/logos/logo-${String(i + 1).padStart(2, "0")}.png`,
);

/* The three real founder testimonial cuts, on camera. Each is paired to
 * its founder below by the branding and captions spoken on screen:
 * [0] Dom, Emma.io. [1] NeoLuxLabs. [2] AI Clinic Assist. */
export const founderVideos = [
  "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a4f8271708c41d4df27eb2e.mp4",
  "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a4f8271708c41d4df27eb29.mp4",
  "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a4f8271eada8c1f458e3266.mp4",
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
        "Super easy process, Easy to deal with, and the video delivered was as advertised.",
      name: "Dominic",
      source: "Google review",
      photo: null as string | null,
      /* Dominic Bavaro's real on-camera cut, same clip as the first
         Client Stories card (founderVideos[0], Dom / Emma.io). Loops
         muted inside the avatar; plays with sound in the click popup. */
      video: founderVideos[0] as string | null,
      poster: null as string | null,
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
        href: "/custom-video/",
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
        mediaKey: "sampleB",
      },
    ],
  },

  manifesto: {
    eyebrow: "About GHL Video",
    statement:
      "GHL Video is video infrastructure built only for HighLevel. Since 2019, 800+ SaaS founders have used us to turn video from a cost line into demos closed, churn cut, and authority earned.",
    /* the positioning phrase lifted into gold; must be a substring */
    emphasis: "built only for HighLevel",
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
    intro:
      "Founders behind some of the fastest-growing tools on HighLevel, in their own words.",
    /* summary: a very short editorial takeaway of each review, shown
       under the clip and above the name */
    items: [
      {
        name: "Dominic Bavaro",
        company: "Emma.io",
        src: founderVideos[0],
        poster: null,
        summary:
          "One form, seven days later, an explainer that made his offer land instantly.",
      },
      {
        name: "Ryan Maule",
        company: "AI Clinic Assist",
        src: founderVideos[2],
        poster: null,
        summary:
          "Owns a video team, still outsourced his HighLevel content and gained leads and profit.",
      },
      {
        name: "David Allen Neron",
        company: "NeoLuxLabs",
        src: founderVideos[1],
        poster: null,
        summary:
          "Abandoned his own Premiere Pro edit the moment their demo landed.",
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
    intro:
      "A slice of recent work across premade, custom, and editing. Every frame plays.",
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
    headline: "Why HighLevel founders pick",
    accent: "GHL Video.",
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
        { label: "Custom production", href: "/custom-video/" },
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
