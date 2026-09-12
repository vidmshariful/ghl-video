/*
 * What a client's portal shows, worked out from what they actually have.
 *
 * Before this, every account saw everything (the premade store, the editing
 * plans, the affiliate offer, all of it) unless somebody in admin flipped 13
 * switches by hand, and three real clients were tuned that way. Now a
 * section appears because the account has that service line, the lines it
 * does not have collapse into a quiet Get more group, and the offers group
 * disappears for a retainer partner (owner decisions, 12 September 2026).
 *
 * The hand switches survive as overrides, but they only ever narrow: a hidden
 * override removes a section the rules would show, a disabled override greys
 * one the rules would show. Neither can force a section the account has no
 * reason to see, because that was the whole problem.
 *
 * Import-free on purpose: the portal's server route decides with it, the
 * portal's client reads it, and admin explains it. One rule, three readers.
 */

export type ServiceLines = {
  /** bought something off the shelf, or had a manual sale recorded */
  premade: boolean;
  /** has a custom project, or may brief one directly */
  custom: boolean;
  /** has ever had an editing plan, live or not: the past months are still theirs */
  editing: boolean;
};

export type AccountShape = {
  lines: ServiceLines;
  /** on a retainer partnership (custom work at a flat monthly fee) */
  retainer: boolean;
  /** anything to pay or look up: an order or an invoice */
  hasBilling: boolean;
  /** anything recurring: a subscription row, whatever its status */
  hasPlanBilling: boolean;
  /** admin overrides, both only ever narrowing */
  hidden: string[];
  disabled: string[];
};

export type PortalVisibility = {
  /** section keys in the menu, in no particular order */
  visible: string[];
  /** the subset shown greyed and locked */
  disabled: string[];
  /** whether the owner-only offers group (affiliate, white-label, SocialX) shows at all */
  offers: boolean;
};

/* the sections that are never a question */
const ALWAYS = ["dashboard", "messages", "settings", "help"];
const OFFERS = ["affiliate", "whitelabel", "socialx"];

export function portalVisibility(a: AccountShape): PortalVisibility {
  const { premade, custom, editing } = a.lines;
  const anyLine = premade || custom || editing;
  const rule = new Set<string>(ALWAYS);

  /* the brand kit is only worth asking for once there is work to put it on */
  if (anyLine) rule.add("brand");

  /* their work: one screen per line they have */
  if (premade) rule.add("videos");
  if (custom || a.retainer) rule.add("projects");
  if (editing) rule.add("subscriptions");

  /* the store: for people who buy off the shelf, and for a brand new account
     with nothing yet. Not pushed at a custom or editing client, and never at
     a partner. */
  if ((premade || !anyLine) && !a.retainer) {
    rule.add("library");
    rule.add("coming-soon");
  }
  /* the way into custom work, for accounts not already in it */
  if (!custom && !a.retainer) rule.add("book");

  /* money: only the kinds they have */
  if (a.hasBilling) rule.add("orders");
  if (a.hasPlanBilling) rule.add("billing");

  const offers = !a.retainer;
  if (offers) for (const k of OFFERS) rule.add(k);

  const hidden = new Set(a.hidden);
  const visible = [...rule].filter((k) => !hidden.has(k) || ALWAYS.includes(k));
  const shown = new Set(visible);
  const disabled = a.disabled.filter((k) => shown.has(k) && !ALWAYS.includes(k));
  return { visible, disabled, offers };
}

/** The lines an account has, from counts. Kept here so every caller agrees on the threshold. */
export function linesFrom(counts: {
  premadeOrders: number;
  projects: number;
  directBrief: boolean;
  subscriptions: number;
}): ServiceLines {
  return {
    premade: counts.premadeOrders > 0,
    custom: counts.projects > 0 || counts.directBrief,
    editing: counts.subscriptions > 0,
  };
}
