/*
 * What one client is worth to us, and what kind of client they are.
 *
 * Import-free so it can be tested directly, which matters more here than
 * usual: the screen this replaces reported a live client on a $995 a month
 * plan as worth nothing, because it summed paid orders and a subscription
 * is not an order. That was invisible for months. It is now arithmetic with
 * tests around it rather than a reduce buried in a component.
 */

export type MoneySource = {
  /*
   * Every one-time order, including invoice payments.
   *
   * An invoice does NOT hold its own money. It is backed by a one_time
   * product and paid through the ordinary checkout, so paying one creates an
   * order like any other purchase. Adding invoice totals to order totals
   * would therefore count the same money twice, which is why invoices are
   * split here by `viaInvoice` rather than summed as a third stream.
   */
  orders: { amountCents: number; status: string; viaInvoice: boolean }[];
  /** every subscription we have ever opened for them */
  subscriptions: {
    amountCents: number | null;
    status: string;
    createdAt: string;
    currentPeriodEnd: string | null;
  }[];
  /** raised and still unpaid. Paid ones are already in `orders`. */
  openInvoices: { totalCents: number }[];
};

export type Lifetime = {
  /** everything they have actually paid us, across all three services */
  totalCents: number;
  /** bought off the shelf */
  premadeCents: number;
  /** paid against an invoice we raised, which is how custom work is billed */
  customCents: number;
  subscriptionsCents: number;
  /** what they pay us every month right now */
  monthlyCents: number;
  /** raised and not yet paid, so never part of the total */
  openInvoicesCents: number;
  /** money handed back, kept separate rather than netted into the total */
  refundedCents: number;
};

/* A subscription that never completed its first payment took no money. Stripe
 * expires these on its own and they are the bulk of what a test account
 * leaves behind, so counting them would inflate every number on the screen. */
const NEVER_PAID = new Set(["incomplete", "incomplete_expired"]);
/** still taking money every month */
const BILLING = new Set(["active", "trialing", "past_due"]);

const MONTH_MS = 2_629_800_000; // an average month, good enough for elapsed billing

/**
 * How many times a subscription has billed, counted from when it started to
 * whichever came first: its end, or now.
 *
 * Deliberately an estimate. The exact figure lives in Stripe's invoice list
 * and costs an API call per client per screen; this is within one month of
 * the truth, which is the right precision for "what is this client worth".
 */
export function billedMonths(
  createdAt: string,
  status: string,
  currentPeriodEnd: string | null,
  now: Date,
): number {
  if (NEVER_PAID.has(status)) return 0;
  const start = new Date(createdAt).getTime();
  const stopped = !BILLING.has(status) && currentPeriodEnd
    ? new Date(currentPeriodEnd).getTime()
    : now.getTime();
  const end = Math.min(stopped, now.getTime());
  if (!Number.isFinite(start) || end <= start) return 1; // paid at least once
  return Math.max(1, Math.round((end - start) / MONTH_MS) + 1);
}

export function lifetimeValue(src: MoneySource, now: Date): Lifetime {
  const paid = src.orders.filter((o) => o.status === "paid");
  const premadeCents = paid
    .filter((o) => !o.viaInvoice)
    .reduce((s, o) => s + o.amountCents, 0);
  const customCents = paid
    .filter((o) => o.viaInvoice)
    .reduce((s, o) => s + o.amountCents, 0);

  const refundedCents = src.orders
    .filter((o) => o.status === "refunded")
    .reduce((s, o) => s + o.amountCents, 0);

  const subscriptionsCents = src.subscriptions.reduce(
    (s, x) =>
      s +
      (x.amountCents ?? 0) *
        billedMonths(x.createdAt, x.status, x.currentPeriodEnd, now),
    0,
  );

  const monthlyCents = src.subscriptions
    .filter((x) => BILLING.has(x.status))
    .reduce((s, x) => s + (x.amountCents ?? 0), 0);

  /* Money we have asked for and not received. Never added to the total: an
   * unpaid invoice is a hope, not revenue. */
  const openInvoicesCents = src.openInvoices.reduce((s, i) => s + i.totalCents, 0);

  return {
    totalCents: premadeCents + customCents + subscriptionsCents,
    premadeCents,
    customCents,
    subscriptionsCents,
    monthlyCents,
    openInvoicesCents,
    refundedCents,
  };
}

/* ---------- what kind of client this is ---------- */

export type ServiceTag = "premade" | "custom" | "editing";

/**
 * Derived, never stored. A stored tag is wrong the moment somebody buys
 * something new, and the whole reason the old screen showed none is that
 * tags only ever lived in HighLevel.
 */
export function serviceTags(counts: {
  paidOrders: number;
  projects: number;
  liveSubscriptions: number;
}): ServiceTag[] {
  const tags: ServiceTag[] = [];
  if (counts.paidOrders > 0) tags.push("premade");
  if (counts.projects > 0) tags.push("custom");
  if (counts.liveSubscriptions > 0) tags.push("editing");
  return tags;
}

export const SERVICE_TAG_LABEL: Record<ServiceTag, string> = {
  premade: "Premade",
  custom: "Custom",
  editing: "Editing",
};
