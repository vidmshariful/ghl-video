import { aiPackClips } from "@/lib/content/premade";

/*
 * The registry of sales landing pages. Each page is a code-defined
 * composition (built with the .sp design system + components/sales/*),
 * and this config carries the campaign copy + the video assets. The admin
 * "Sales Pages" screen lists these so the team can grab a link to send.
 *
 * Assets set to null render a clean placeholder until the real clip is in
 * (same pattern as the main site). Swap the VSL, client-work, and the
 * default/branded pair when they are delivered.
 */
export type SalesPageStatus = "live" | "draft";

export type SalesClip = {
  src: string | null;
  poster: string | null;
  label: string;
  sub: string;
};

export type SalesPage = {
  slug: string;
  title: string; // internal name shown in the admin list
  campaign: string; // what it is used for
  status: SalesPageStatus;
  hero: {
    eyebrow: string;
    headline: string;
    accent: string;
    sub: string;
    vslSrc: string | null;
    vslPoster: string | null;
  };
  /* recent branded deliveries, shown as a "real work" showcase */
  clientWork: SalesClip[];
  /* the same video, HighLevel's default cut vs branded to the client */
  whiteLabel: { defaultSrc: string | null; brandedSrc: string | null; poster: string | null };
  closing: { headline: string; accent: string; sub: string };
  /* when true, the page is a real, indexable funnel page (not a private
     outreach-only LP) and uses the seo block for its metadata. */
  indexable?: boolean;
  seo?: { title: string; description: string };
};

export const salesPages: SalesPage[] = [
  {
    slug: "new-videos",
    title: "White-Label HighLevel Videos",
    campaign: "Universal funnel page (SEO, paid, and outreach)",
    status: "live",
    indexable: true,
    seo: {
      title: "HighLevel White-Label Videos and Demos, Branded to Your SaaS",
      description:
        "Launch-ready HighLevel white-label videos: explainers, platform demos, and feature videos, each branded to your SaaS with your logo, dashboard, and voiceover. Order a single video or a pack and publish this week.",
    },
    hero: {
      eyebrow: "HighLevel white-label videos and demos",
      headline: "White-label HighLevel videos,",
      accent: "branded to your SaaS.",
      sub: "Launch-ready HighLevel explainers, platform demos, and feature videos, each one white-labeled to your platform: your logo, your dashboard, your voiceover. Watch the work, order a single video or the whole pack, and publish this week.",
      /* STAND-IN until the real VSL is delivered: shows the master explainer
         so the hero is not empty. Swap vslSrc/vslPoster for the VSL. */
      vslSrc: aiPackClips.master,
      vslPoster: "/posters/ai-master.jpg",
    },
    clientWork: [
      {
        src: aiPackClips.master,
        poster: "/posters/ai-master.jpg",
        label: "All-in-one + AI-First Positioning",
        sub: "Master explainer, branded",
      },
      {
        src: aiPackClips.demo,
        poster: null,
        label: "Lead-to-Close With AI",
        sub: "Platform demo, branded",
      },
      {
        src: aiPackClips.receptionist,
        poster: "/posters/ai-receptionist.jpg",
        label: "AI Receptionist + Conversational AI",
        sub: "Feature explainer, branded",
      },
      {
        src: aiPackClips.reputation,
        poster: "/posters/ai-reputation.jpg",
        label: "Reputation Management + Reviews AI",
        sub: "Feature explainer, branded",
      },
      {
        src: aiPackClips.inbox,
        poster: "/posters/ai-inbox.jpg",
        label: "Unified Inbox + Conversational AI",
        sub: "Feature explainer, branded",
      },
      {
        src: aiPackClips.social,
        poster: null,
        label: "Social Media Planner + Content AI",
        sub: "Feature explainer, branded",
      },
      {
        src: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a56fa0fbaf5f6da40287c33.mp4",
        poster: "/posters/hl-full-pitch.jpg",
        label: "HighLevel Full Platform Pitch",
        sub: "Full platform pitch, branded",
      },
    ],
    whiteLabel: {
      defaultSrc: null,
      brandedSrc: aiPackClips.master,
      poster: "/posters/ai-master.jpg",
    },
    closing: {
      headline: "Your videos are",
      accent: "one order away.",
      sub: "Pick a single or the full pack, send your brand kit, and publish this week. Most orders land in 5 to 7 days.",
    },
  },
];

export const salesPageBySlug = (slug: string): SalesPage | undefined =>
  salesPages.find((p) => p.slug === slug);

export const salesPageUrl = (slug: string): string => `/lp/${slug}`;

/* Shared sales copy, reused across landing pages. */
export const salesShared = {
  howItWorks: {
    heading: "Order today,",
    accent: "publish this week.",
    steps: [
      {
        n: "01",
        title: "Order",
        line: "Pick a single video or the full pack and check out. No call required.",
      },
      {
        n: "02",
        title: "Send your brand kit",
        line: "Logo, colors, dashboard screens, and voiceover choice, through a short intake form.",
      },
      {
        n: "03",
        title: "Receive and publish",
        line: "We white-label every video to your SaaS and deliver after a full review round, in 5 to 7 days.",
      },
    ],
  },
  guarantees: [
    { title: "Full commercial rights", line: "Every video is yours to run across your whole funnel, forever." },
    { title: "White-label from frame one", line: "Your logo, dashboard, colors, and voiceover. Nothing points back to us." },
    { title: "A HighLevel-fluent team", line: "You never explain the platform. We only make HighLevel videos, since 2020." },
    { title: "Clear refund policy", line: "Not the right fit? Our refund policy is published and plain." },
  ],
  faq: [
    {
      q: "Is the video really mine to use anywhere?",
      a: "Yes. Every video ships with full commercial rights. Run it as an ad, embed it on your site, use it in onboarding. No attribution, no license tiers.",
    },
    {
      q: "How custom does each video get?",
      a: "Your logo, your brand colors, your dashboard screens, and your voiceover. The scripts are brand-agnostic by design, so nothing names a competitor and every video white-labels cleanly for your SaaS.",
    },
    {
      q: "How fast is delivery?",
      a: "Most orders land in 5 to 7 days after you send your branding. You get one full review round before final delivery.",
    },
    {
      q: "What if the premade videos do not fit what I need?",
      a: "Then we build it custom, scripted and produced for your exact positioning. Book a quick call and we will scope it with you.",
    },
    {
      q: "What is a HighLevel white-label video?",
      a: "It is a professionally produced GoHighLevel explainer, demo, or feature video that we rebrand to your platform. You get the finished video with your logo, your dashboard screens, your colors, and a voiceover that names your brand, so it reads as yours end to end.",
    },
    {
      q: "Do you make white-label HighLevel demo videos?",
      a: "Yes. Our platform demos walk a prospect through HighLevel branded as your SaaS, so they see your product win before the sales call. They cut repeat demos and save your team hours every week.",
    },
    {
      q: "How much does a HighLevel white-label video cost?",
      a: "Single videos start at $97 and most explainers are $495, with packs and bundles bringing the per-video price down. Full pricing sits on every card, so there is no quote to wait on.",
    },
    {
      q: "Can you match my niche or industry?",
      a: "Yes. For an extra $50 per video we tailor it to your ICP: footage, on-screen graphics, and the wording in the script and voiceover, like saying clients instead of customers, or patients for a medical niche.",
    },
    {
      q: "Can I resell or use these across my whole funnel?",
      a: "Every video ships with full commercial rights and no attribution. Run it as an ad, embed it on your site, put it in onboarding, or deploy it for your own clients. It is yours to use anywhere.",
    },
  ],
};
