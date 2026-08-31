import { deliveryWindow, studioSince } from "@/lib/content/core";
import { nicheAddon } from "@/lib/content/niche";
import { recentDeliveries, whiteLabelProof } from "@/lib/content/deliveries";

/*
 * The registry of sales landing pages. Each page is a code-defined
 * composition (built with the .sp design system + components/sales/*),
 * and this config carries the campaign copy + the video assets. The admin
 * "Sales Pages" screen lists these so the team can grab a link to send.
 *
 * This file is landing-page CONTENT only. The bundle offer + intake-picker
 * logic lives in lib/bundles.ts (imported by checkout + admin too), so
 * editing a landing page never touches the code the money path validates.
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

/* Fields every sales page shares, whichever kind it is. */
type SalesPageBase = {
  slug: string;
  title: string; // internal name shown in the admin list
  campaign: string; // what it is used for
  status: SalesPageStatus;
  /* when true, the page is a real, indexable funnel page (not a private
     outreach-only LP) and uses the seo block for its metadata. */
  indexable?: boolean;
  seo?: { title: string; description: string };
};

/* One product, one page. The premade kind below shows the whole library and
   lets somebody choose; this one sells a single pack, so it carries no
   composition of its own: every fact on it comes from the catalogue entry
   for that pack. Rendered by components/sales/PackLanding. */
export type PackSalesPage = SalesPageBase & {
  kind: "pack";
};

/* Custom production: the four formats with their published floors, and the
   quote form as the close. Rendered by components/sales/CustomLanding, and
   every fact on it comes from pages.custom, the same copy the marketing page
   uses. Nothing to configure per campaign yet, so it carries no composition. */
export type CustomSalesPage = SalesPageBase & {
  kind: "custom";
};

/* The default kind: a premade-video landing page (library + bundles +
 * white-label showcase). Rendered inline by app/(sales)/lp/[slug]/page.tsx. */
export type PremadeSalesPage = SalesPageBase & {
  kind?: "premade";
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
};

/* An affiliate-partner landing page: a partner-branded pitch for the editing
 * service. The discount + credit come from the partner's affiliateRef (see
 * lib/affiliates.ts); the render lives in components/sales/PartnerLanding.tsx.
 * Add one of these and a matching lib/affiliates.ts entry to launch a partner. */
export type PartnerSalesPage = SalesPageBase & {
  kind: "partner";
  /* when true, render the multi-service template (premade + editing + custom)
     via MultiPartnerLanding; otherwise the editing-only PartnerLanding. */
  full?: boolean;
  /* the partner's ref, keyed into lib/affiliates.ts (drives discount + credit) */
  affiliateRef: string;
  partner: {
    name: string;
    role: string; // e.g. "GHL Video affiliate partner"
    photo: string | null; // /partners/<slug>.jpg, or null for a designed placeholder
    tagline: string; // "A friend of Jonah is a friend of GHL Video."
    offer: string; // the discount line shown in the hero
    endorsement?: string; // one line in the partner's own voice (needs their sign-off)
    heroVideoSrc?: string | null; // optional showreel; null renders a placeholder
    heroVideoPoster?: string | null;
  };
  closing: { headline: string; accent: string; sub: string };
};

/* The editing service on its own page, for paid ads and for the link we send
 * when somebody replies to a cold email. Every word of it lives in
 * lib/content/editing-lp.ts and the render in components/sales/EditingLanding.
 * There is nothing to configure per page, so this kind carries no fields of
 * its own: it is a registry entry so the admin Sales Pages screen lists it and
 * the route builds it, like every other LP. */
export type EditingSalesPage = SalesPageBase & {
  kind: "editing";
};

export type SalesPage =
  | PremadeSalesPage
  | PartnerSalesPage
  | EditingSalesPage
  | PackSalesPage
  | CustomSalesPage;

export const salesPages: SalesPage[] = [
  {
    kind: "editing",
    slug: "video-editing-for-highlevel-creators",
    title: "Video Editing for HighLevel Creators",
    campaign: "Paid ads, and the link sent on a cold email reply",
    status: "live",
    /* a real funnel page rather than private outreach: we are paying for the
       traffic either way, so organic is upside (owner decision, 25 Aug 2026) */
    indexable: true,
    seo: {
      title: "Video Editing for HighLevel Creators",
      description:
        "Video editing for HighLevel agencies and SaaS founders who publish every week. Send raw footage, get finished edits back in two to three business days. Plans from $595 a month, unlimited revisions, no contract.",
    },
  },
  {
    kind: "custom",
    slug: "custom-video",
    title: "Custom Video Production",
    campaign: "Paid traffic and outreach for bespoke production",
    status: "live",
    indexable: true,
    seo: {
      title: "Custom Video Production for HighLevel SaaS",
      description:
        "Bespoke explainers, ads, demos and onboarding series for HighLevel SaaS founders. Published starting prices from $1,500, a fixed quote in 24 hours, and you approve every step.",
    },
  },
  {
    kind: "pack",
    slug: "ai-first-saas-pack",
    title: "AI First SaaS Pack",
    campaign: "Paid traffic and outreach for the nine video pack",
    status: "live",
    indexable: true,
    seo: {
      title: "HighLevel White-Label Video Pack, Every AI Capability",
      description:
        "Nine white-label HighLevel videos, each one showing the AI inside a feature: AI Receptionist, Conversational AI, Reviews AI, Content AI, Ask AI and more. Buy one at $495 or the set at $1,995, branded to your SaaS.",
    },
  },
  {
    slug: "white-label-videos",
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
      eyebrow: `The HighLevel-only video studio, since ${studioSince}`,
      headline: "White-label HighLevel videos,",
      accent: "branded to your SaaS.",
      sub: "Launch-ready HighLevel explainers, platform demos, and feature videos, each one white-labeled to your platform: your logo, your dashboard, your voiceover. Watch the work, order a single video or the whole pack, and publish this week.",
      /* the hero video for this page; swap vslSrc/vslPoster to change it */
      vslSrc: "https://assets.cdn.filesafe.space/s3JXyf9P6cTSxG7NfF1B/media/6a7a47bc03343f290f1f19b9.mp4",
      vslPoster: null,
    },
    /* Real recent client deliveries: the one shared list in lib/content/deliveries. */
    clientWork: recentDeliveries,
    whiteLabel: {
      /* the shared pair, so this page and the pack page cannot drift into
         showing two different videos and calling them the same one */
      defaultSrc: whiteLabelProof.generic,
      brandedSrc: whiteLabelProof.branded,
      poster: whiteLabelProof.poster,
    },
    closing: {
      headline: "Your videos are",
      accent: "one order away.",
      sub: `Pick a single or the full pack, send your brand kit, and publish this week. Most orders land in ${deliveryWindow}.`,
    },
  },
  {
    kind: "partner",
    slug: "jonah-cockshaw",
    title: "Jonah Cockshaw (affiliate)",
    campaign: "Affiliate partner page for Jonah Cockshaw's audience",
    status: "live",
    // Private partner page, not a public SEO funnel: indexable omitted -> noindex.
    affiliateRef: "jonah",
    seo: {
      title: "GHL Video for Friends of Jonah Cockshaw",
      description:
        "Jonah Cockshaw's audience gets 10% off GHL Video's HighLevel video editing service for the first 3 months, applied automatically. Long-form and short-form edits from a HighLevel-fluent team.",
    },
    partner: {
      name: "Jonah Cockshaw",
      role: "GHL Video affiliate partner",
      // The headshot renders once public/partners/jonah-cockshaw.jpg exists;
      // until then PartnerLanding shows a designed "JC" placeholder (it checks
      // the file on disk), so this path is safe to set before the file lands.
      photo: "/partners/jonah-cockshaw.jpg",
      tagline: "A friend of Jonah is a friend of GHL Video.",
      offer:
        "Get 10% off our HighLevel video editing service for your first 3 months, applied automatically at checkout.",
      // endorsement intentionally omitted until Jonah provides a line in his own voice.
      heroVideoSrc: null,
      heroVideoPoster: null,
    },
    closing: {
      headline: "Your videos,",
      accent: "edited and ready.",
      sub: "Start your plan today, send your footage, and get back polished long-form and short-form edits. Your 10% off applies automatically for the first 3 months.",
    },
  },
  {
    // Multi-service partner template (example uses Jonah's name/photo). New
    // partners are cloned from this entry; Jonah's own page above is untouched.
    kind: "partner",
    full: true,
    slug: "partner-template",
    title: "Partner template (all services)",
    campaign: "Multi-service partner page template (premade + editing + custom)",
    status: "live",
    affiliateRef: "jonah",
    seo: {
      title: "GHL Video for Partners",
      description:
        "White-label HighLevel videos, monthly editing, and custom production, with a partner discount applied across everything.",
    },
    partner: {
      name: "Jonah Cockshaw",
      role: "GHL Video affiliate partner",
      photo: "/partners/jonah-cockshaw.jpg",
      tagline: "A friend of Jonah is a friend of GHL Video.",
      offer:
        "Get 10% off everything GHL Video makes: premade white-label videos, monthly editing, and custom production, applied automatically at checkout and honored on custom quotes.",
      heroVideoSrc: null,
      heroVideoPoster: null,
    },
    closing: {
      headline: "Your videos are",
      accent: "one order away.",
      sub: "Pick premade videos, start an editing plan, or book a custom call. Your 10% is applied automatically, and honored on custom quotes.",
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
        line: `We white-label every video to your SaaS and deliver after a full review round, in ${deliveryWindow}.`,
      },
    ],
  },
  guarantees: [
    { title: "Full commercial rights", line: "Every video is yours to run across your whole funnel, forever." },
    { title: "White-label from frame one", line: "Your logo, dashboard, colors, and voiceover. Nothing points back to us." },
    { title: "A HighLevel-fluent team", line: `You never explain the platform. We only make HighLevel videos, since ${studioSince}.` },
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
      a: `Most orders land in ${deliveryWindow} after you send your branding. You get one full review round before final delivery.`,
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
      a: `Yes. For an extra $${nicheAddon.priceStandard} per video, or $${nicheAddon.priceDemo} for a platform demo, we tailor it to your ICP: footage, on-screen graphics, and the wording in the script and voiceover, like saying clients instead of customers, or patients for a medical niche. Bundles have a single pack customization that covers every video inside.`,
    },
    {
      q: "Can I resell or use these across my whole funnel?",
      a: "Every video ships with full commercial rights and no attribution. Run it as an ad, embed it on your site, put it in onboarding, or deploy it for your own clients. It is yours to use anywhere.",
    },
  ],
};
