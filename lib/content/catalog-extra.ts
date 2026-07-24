import { type OldVideoType } from "./classic";

/* ---------------------------------------------------------------- */
/* The Complete Video Stack: the everything bundle, 53 branded videos
 * across five formats at one price, sold on-domain by its sku. Per-format
 * "value" figures are the anchor the sales page frames the $1,995 against. */
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
  /* download versions link out (the free white-label cut); buy versions
     sell on-domain via checkoutSlug and carry no external url */
  url: string | null;
  checkoutSlug?: string;
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
          url: null,
          checkoutSlug: "hl-pitch-logo-only",
          wistiaId: "pyvywzfmao",
          note: "Your logo dropped into the dashboard.",
        },
        {
          slug: "complete-brand",
          name: "Complete Brand Customization",
          price: 495,
          cta: "buy",
          url: null,
          /* the same product as the standalone pitch in the new library */
          checkoutSlug: "highlevel-official-full-platform-pitch",
          wistiaId: "x8drp1z4u8",
          note: "Your logo, colors, and brand name in the voiceover.",
        },
        {
          slug: "uk-accent",
          name: "UK / Australian Accent",
          price: 595,
          cta: "buy",
          url: null,
          checkoutSlug: "hl-pitch-uk-accent",
          wistiaId: "yon4baclgn",
          note: "Full rebrand, re-voiced in a UK or Australian accent.",
        },
        {
          slug: "dutch",
          name: "Dutch Edition",
          price: 695,
          cta: "buy",
          url: null,
          checkoutSlug: "hl-pitch-dutch",
          wistiaId: null,
          note: "Full rebrand, localized in Dutch.",
        },
        {
          slug: "spanish",
          name: "Spanish Edition",
          price: 695,
          cta: "buy",
          url: null,
          checkoutSlug: "hl-pitch-spanish",
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
      "The proven classic catalog at reduced prices. Still brandable, still yours.",
    tiers: [
      {
        slug: "classic-starter",
        name: "Starter",
        price: 795,
        anchorPrice: 1570,
        deliveryDays: 7,
        featured: false,
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
  sku: "complete-video-stack",
  name: "Complete Video Stack",
  tagline:
    "The everything bundle: 53 custom-branded videos mixing our newest releases with the classic library, across every format your HighLevel SaaS needs. One order, live in 10 days.",
  price: 2495,
  anchorPrice: 55000,
  totalCount: 53,
  deliveryDays: 10,
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
