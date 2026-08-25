/*
 * Editing credits: the one place that decides what a piece of work costs.
 *
 * Why credits at all (owner's decision, 25 August 2026). The old model sold a
 * fixed count of "long form" and "short form" videos, and clients do not think
 * in those words. A real client's first three requests were five minute 16:9
 * YouTube videos filed as "short form", because short was the default and
 * nothing in between existed: he spent three of eight short slots while four
 * long slots sat idle, and every card told the editor "short, 16:9, 5 min".
 * A length is a fact the client already knows. A form is a guess they have to
 * make about our internal buckets, and they guess wrong.
 *
 * So: one balance, priced by what the work actually is. The client picks the
 * shape of the video, sees the cost before they submit, and spends however
 * they like.
 *
 * Client-safe: no server-only imports, so the pricing page, the portal and the
 * admin board all read exactly these numbers.
 */

export type EditType = "short" | "mid" | "long" | "podcast_standard" | "podcast_advanced";

/** A video tier costs a flat number of credits. A podcast is priced by runtime. */
type FlatTier = {
  key: EditType;
  kind: "video";
  label: string;
  credits: number;
  /** the ceiling this tier covers, in minutes */
  maxMinutes: number;
  lengthNote: string;
  blurb: string;
  idealFor: string[];
};

type RuntimeTier = {
  key: EditType;
  kind: "podcast";
  label: string;
  /**
   * Credits for every 30 minutes of finished runtime, rounded up.
   *
   * One rate, not an hourly one with a half hour beside it (owner decision,
   * 25 August 2026). The two-rate table made the client do arithmetic to
   * find out that 90 minutes was an hour plus a half, and the answer was
   * never the one they guessed. A flat block rate they can multiply in their
   * head is worth more than the discount the hourly rate was expressing.
   */
  perBlock: number;
  lengthNote: string;
  blurb: string;
  idealFor: string[];
};

export type EditTier = FlatTier | RuntimeTier;

export const EDIT_TIERS: EditTier[] = [
  {
    key: "short",
    kind: "video",
    label: "Short form",
    credits: 1,
    maxMinutes: 1.5,
    lengthNote: "Up to 90 seconds",
    blurb: "Clean cuts and pacing, captions, b-roll, music, branding, basic motion graphics.",
    idealFor: ["Reels", "TikTok", "YouTube Shorts", "LinkedIn video", "Social ads"],
  },
  {
    key: "mid",
    kind: "video",
    label: "Mid form",
    credits: 2,
    maxMinutes: 5,
    lengthNote: "Up to 5 minutes",
    blurb: "The same edit, at the length most explainers and product videos actually run.",
    idealFor: ["Explainers", "Product videos", "Case studies", "Sales and marketing video"],
  },
  {
    key: "long",
    kind: "video",
    label: "Long form",
    credits: 3,
    maxMinutes: 15,
    lengthNote: "Up to 15 minutes",
    blurb: "Full length edits with the structure a longer watch needs.",
    idealFor: ["YouTube videos", "Tutorials", "Talking head", "Thought leadership"],
  },
  {
    key: "podcast_standard",
    kind: "podcast",
    label: "Podcast or interview, standard",
    perBlock: 4,
    lengthNote: "Priced on finished runtime",
    blurb: "Clean, professional editing without heavy post.",
    idealFor: [
      "Speakers and screen share synced",
      "Mistakes and dead air removed",
      "Cutting between speakers and screen",
      "Audio cleanup",
      "Intro and outro",
      "Titles and chapters",
      "Captions",
      "Light b-roll and graphics",
    ],
  },
  {
    key: "podcast_advanced",
    kind: "podcast",
    label: "Podcast or interview, advanced",
    perBlock: 5,
    lengthNote: "Priced on finished runtime",
    blurb: "Everything in standard, cut for a more engaging watch.",
    idealFor: [
      "Everything in standard",
      "Heavier b-roll",
      "More graphics and custom visuals",
      "Motion graphics and animation",
      "Enhanced visual storytelling",
    ],
  },
];

export const tierFor = (key: string): EditTier | null =>
  EDIT_TIERS.find((t) => t.key === key) ?? null;

export const isPodcast = (key: string): boolean => tierFor(key)?.kind === "podcast";

/** Every tier that is not a podcast, in the order a client reads them. */
export const VIDEO_TIERS = EDIT_TIERS.filter((t): t is FlatTier => t.kind === "video");
export const PODCAST_TIERS = EDIT_TIERS.filter((t): t is RuntimeTier => t.kind === "podcast");

/**
 * What one piece of work costs.
 *
 * A video tier is flat: the tier already names its ceiling, so a 40 second
 * short and an 80 second short cost the same. A podcast is billed on FINISHED
 * runtime in blocks of 30 minutes, rounded up, because "an hour of podcast"
 * is the only number a client can state without guessing: source footage
 * depends on how many people recorded and for how long, and they should not
 * have to work that out to know what they are spending.
 *
 * One rate per block, so the sum is the client's own multiplication: standard
 * 30 min costs 4, 60 costs 8, 90 costs 12. Runtime is ignored for video
 * tiers. Note that a stored credit_cost is what an existing request was
 * charged, so changing a rate here never reprices work already asked for.
 */
export function creditCost(type: string, runtimeMinutes?: number | null): number {
  const tier = tierFor(type);
  if (!tier) return 0;
  if (tier.kind === "video") return tier.credits;
  const mins = Math.max(1, Math.round(runtimeMinutes ?? 0));
  const blocks = Math.max(1, Math.ceil(mins / 30));
  return blocks * tier.perBlock;
}

/** "2 credits", "1 credit". Said the way a person says it. */
export const creditWord = (n: number): string => `${n} ${n === 1 ? "credit" : "credits"}`;

/**
 * The tier a length belongs in, used to suggest the right one as the client
 * types a duration, and to backfill work recorded before credits existed.
 */
export function tierForMinutes(minutes: number): EditType {
  if (minutes <= 1.5) return "short";
  if (minutes <= 5) return "mid";
  return "long";
}

/**
 * What a plan's credits are worth against the old two-bucket model, so a
 * client on the old plan can be told what changed without doing arithmetic.
 * Kept beside the tiers because it is the same table read backwards.
 */
export const LEGACY_EQUIVALENT = { longForm: 3, shortForm: 1 } as const;

/* ---------- top-ups ---------- */

/**
 * Extra credits, bought when a month runs out.
 *
 * Priced above every plan's own rate on purpose: topping up repeatedly should
 * always cost more than moving up a plan, so the upgrade is the obvious move
 * rather than the one we have to argue for. Plan credits reset every month;
 * these do not expire, because they were paid for separately and taking them
 * away at the month boundary would be theft with a calendar.
 */
export const TOPUP_CREDIT_PRICE = 75;

export const TOPUP_PACKS = [
  { sku: "editing-credits-5", credits: 5, price: 375 },
  { sku: "editing-credits-10", credits: 10, price: 700 },
  { sku: "editing-credits-20", credits: 20, price: 1300 },
] as const;

export const topupPack = (sku: string) => TOPUP_PACKS.find((p) => p.sku === sku) ?? null;
