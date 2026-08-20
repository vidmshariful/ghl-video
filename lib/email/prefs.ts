/*
 * What a client has chosen to be emailed about.
 *
 * Import-free so the server gate and the portal screen read one list, and so
 * the rules can be tested without a database.
 *
 * Two categories, not twelve. A preference screen with a row per template is
 * a screen nobody finishes, and it turns every future email into a decision
 * somebody has to make about a thing they have not seen yet.
 *
 * Money and access are not offered as a choice. An invoice, a failed payment,
 * a price change and a login are things somebody has to be told about
 * whatever they have switched off. Offering the switch and then ignoring it
 * would be worse than not offering it.
 */

export type EmailCategory = "progress" | "offers";

export const EMAIL_CATEGORIES: {
  key: EmailCategory;
  label: string;
  blurb: string;
}[] = [
  {
    key: "progress",
    label: "Progress on my videos",
    blurb:
      "A video is ready to watch, your changes are in hand, an order is delivered. Turn this off and you will need to check the portal yourself.",
  },
  {
    key: "offers",
    label: "Offers and new releases",
    blurb: "New videos in the library, and the occasional deal. Never more than a few a month.",
  },
];

/*
 * Which category each email belongs to.
 *
 * Anything absent is unconditional: money, access, and the emails that go to
 * us rather than to them.
 */
export const CATEGORY_FOR: Record<string, EmailCategory> = {
  video_ready: "progress",
  video_reply: "progress",
  order_delivered: "progress",
  /* the campaign blast does not go through sendTemplate, so its send route
   * checks the same category directly. Named here so the two lists cannot
   * drift and so a switch can never be offered that controls nothing. */
  campaign: "offers",
};

export type EmailPrefs = Partial<Record<EmailCategory, boolean>>;

/**
 * May we send this one?
 *
 * Absent means yes. A category added next year must never arrive switched
 * off for everybody who signed up before it existed, which is what a
 * default of false would do.
 */
export function mayEmail(templateKey: string, prefs: EmailPrefs | null | undefined): boolean {
  const category = CATEGORY_FOR[templateKey];
  if (!category) return true;
  return prefs?.[category] !== false;
}

/** Only the keys we recognise, and only booleans. */
export function sanitizePrefs(input: unknown): EmailPrefs {
  const out: EmailPrefs = {};
  if (!input || typeof input !== "object") return out;
  for (const { key } of EMAIL_CATEGORIES) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}
