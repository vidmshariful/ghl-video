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
  /* the review ask is a favour we ask, not progress they need */
  review_request: "offers",
  project_digest: "progress",
  video_ready: "progress",
  video_reply: "progress",
  order_delivered: "progress",
  /* the studio's own words on an order, and the brief landing: progress on
   * their videos in the plainest sense */
  order_update: "progress",
  brief_received: "progress",
  /* the morning sweep's reminders. They carried no category until 15
   * September 2026, so a client who had switched progress emails off was
   * still nudged by them, the one thing the switch promised not to do. The
   * reminder stops; the work still waits in their portal. */
  approval_reminder: "progress",
  approval_reminder_batch: "progress",
  intake_reminder: "progress",
  retainer_check_in: "progress",
  /* the campaign blast does not go through sendTemplate, so its send route
   * checks the same category directly. Named here so the two lists cannot
   * drift and so a switch can never be offered that controls nothing. */
  campaign: "offers",
};

/*
 * The client emails that are deliberately not a choice, each with its reason.
 *
 * Not read by mayEmail: absence from CATEGORY_FOR already means unconditional.
 * This list exists so the decision is written down rather than implied by an
 * omission, and so the unit test can prove that every email a client can
 * receive is either a choice or named here. A new template in neither list
 * fails the tests until somebody decides.
 */
export const ALWAYS_SENT: Record<string, string> = {
  order_confirmation: "money: the receipt",
  order_refunded: "money: money going back to them",
  invoice_sent: "money: an invoice to pay",
  invoice_paid: "money: the receipt for an invoice",
  quote_sent: "money: a price to accept or decline",
  subscription_started: "money: a plan has started charging",
  subscription_price_changed: "money: the price is changing",
  subscription_canceled: "money: the plan has stopped",
  agreement_ready: "terms: a partnership agreement to accept",
  portal_welcome: "access: their login exists",
  team_invite: "access: a seat was made for them",
  partner_invite: "access: their partner login",
  partner_application_received: "access: their application landed (not in use)",
  quote_received: "a lead who just asked; they have no preferences yet",
  approval_request: "the work is stopped until they act; a held ask would stall the project",
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
