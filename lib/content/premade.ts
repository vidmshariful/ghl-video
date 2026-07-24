import { skuFor } from "./codes";

/* ------------------------------------------------------------------ */
/* Services and pricing (locked)                                        */
/* ------------------------------------------------------------------ */

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
export const aiPackClips = {
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
  categories: PackCategory[];
};

/* One pack at launch: the AI First SaaS Pack (real). Five of the
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
    comingSoon: false,
  },
];

export const premadeVideos: PremadeVideo[] = [...packVideos, ...standaloneNew];

/* Everything is sold on-domain: the external order.ghlvideo.com pages are
 * retired. `sellableProducts` (end of this file) is the single source that
 * seeds the products table, so adding a video or pack to the catalog above
 * makes its /checkout/<sku> page live after "Sync from catalog" in admin. */

/** The on-domain checkout URL for a premade catalog slug. The sku is the
 *  product code (skuFor), so /checkout/<sku> is the stable, rename-proof
 *  URL. Subscription plans link `/checkout/<plan.sku>` directly instead:
 *  their sku is tied to a Stripe price and never goes through skuFor. */
export function checkoutHref(slug: string): string {
  return `/checkout/${skuFor(slug)}`;
}

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

/* anchorPrice is the published list price; `price` is what is charged.
 * A struck-through number is a claim about a former price, so these are
 * list prices to stand behind, not decoration. Chosen so all three read
 * "save 25%" rather than a ragged 25 / 23 / 22. */
export const editingPlans = [
  {
    name: "Starter",
    sku: "editing-starter",
    price: 595,
    anchorPrice: 795,
    longForm: 2,
    longFormNote: "up to 15 min each",
    shortForm: 4,
    featured: false,
  },
  {
    name: "Growth",
    sku: "editing-growth",
    price: 995,
    anchorPrice: 1325,
    longForm: 4,
    shortForm: 8,
    featured: true,
  },
  {
    name: "Scale",
    sku: "editing-scale",
    price: 1795,
    anchorPrice: 2395,
    longForm: 8,
    shortForm: 16,
    featured: false,
    note: "priority queue",
  },
] as const;

/* editingAllPlans (the one-line "no contracts, unlimited revisions,
 * HighLevel-fluent team") was promoted to pages.editing.allPlans, a
 * section of its own: those three facts are what unblock a monthly
 * commitment, and they were doing that job as one line of body copy.
 * The line is gone rather than kept, so the page does not say the same
 * three things twice in consecutive sections. */
