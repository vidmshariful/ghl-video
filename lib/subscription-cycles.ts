import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { editingPlans } from "@/lib/content/premade";
import { cycleWindow } from "@/lib/subscription-slots";

/*
 * The billing month a plan is currently in, created on demand.
 *
 * A cycle row exists so a month's allowance is a fact rather than a
 * calculation: it is COPIED from the plan when the month opens and never read
 * live again. That is what lets somebody change plan without rewriting what
 * last March promised, and what makes "you had four long form videos in
 * August" answerable a year later.
 *
 * Cycles are made lazily, the first time anybody looks at or adds to the
 * month, rather than by a scheduled job. A cron that silently stops leaves
 * months missing and slots uncountable; this cannot drift, because the thing
 * that needs the cycle is the thing that creates it.
 */

type DB = SupabaseClient;

/** How many credits a plan sku grants each month, from the catalogue. */
export function creditsFor(sku: string | null): number {
  return editingPlans.find((p) => p.sku === sku)?.credits ?? 0;
}

export function planNameFor(sku: string | null): string {
  return editingPlans.find((p) => p.sku === sku)?.name ?? "Editing";
}

/** What the pack promises, in the words the client bought it with. */
export function planFeatures(sku: string | null): string[] {
  const plan = editingPlans.find((p) => p.sku === sku);
  return plan ? [...plan.features] : [];
}

/** Scale jumps the line, which is a thing the editing page sells. */
export function planPriority(sku: string | null): number {
  return sku === "editing-scale" ? 0 : sku === "editing-growth" ? 1 : 2;
}

export type Cycle = {
  id: string;
  periodStart: string;
  periodEnd: string;
  creditsAllowed: number;
  planSku: string | null;
};

/**
 * The cycle covering right now for this subscription, made if absent.
 *
 * Returns null when the plan has no period end to anchor to, which is true of
 * a subscription that never completed its first payment. Such a plan owes no
 * videos, so it has no month.
 */
export async function currentCycle(
  db: DB,
  sub: {
    id: string;
    current_period_end: string | null;
    product?: { sku?: string | null } | null;
  },
): Promise<Cycle | null> {
  if (!sub.current_period_end) return null;
  const { start, end } = cycleWindow(new Date(sub.current_period_end));
  const periodStart = start.toISOString();

  const { data: existing } = await db
    .from("subscription_cycles")
    .select("*")
    .eq("subscription_id", sub.id)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (existing) return toCycle(existing);

  const sku = sub.product?.sku ?? null;
  const credits = creditsFor(sku);
  /* upsert, not insert: two tabs opening the portal at once would otherwise
   * race and one would fail on the unique pair */
  const { data: made } = await db
    .from("subscription_cycles")
    .upsert(
      {
        subscription_id: sub.id,
        period_start: periodStart,
        period_end: end.toISOString(),
        credits_allowed: credits,
        /* the old per-form columns are not null, and they are still what the
           already-billed history was measured in, so they keep the same
           arithmetic rather than being zeroed */
        long_form_allowed: Math.floor(credits / 5),
        short_form_allowed: Math.floor(credits / 5) * 2,
        plan_sku: sku,
      },
      { onConflict: "subscription_id,period_start" },
    )
    .select("*")
    .single();
  return made ? toCycle(made) : null;
}

/** Every month this plan has had, newest first. */
export async function cycleHistory(db: DB, subscriptionId: string): Promise<Cycle[]> {
  const { data } = await db
    .from("subscription_cycles")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("period_start", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(toCycle);
}

function toCycle(r: Record<string, unknown>): Cycle {
  return {
    id: String(r.id),
    periodStart: String(r.period_start),
    periodEnd: String(r.period_end),
    creditsAllowed: Number(r.credits_allowed ?? 0),
    planSku: (r.plan_sku as string | null) ?? null,
  };
}

/**
 * Bought credits still unspent, across the whole life of the plan.
 *
 * Top-ups do not expire, so the balance is everything ever granted minus what
 * every month spent beyond its own plan grant. Working it out from the rows
 * rather than keeping a running total means the number can always be
 * explained, and "where did my credits go" is answerable.
 */
export async function topupCreditsLeft(db: DB, subscriptionId: string): Promise<number> {
  const [{ data: grants }, { data: cycles }] = await Promise.all([
    db.from("editing_credit_grants").select("credits").eq("subscription_id", subscriptionId),
    db
      .from("subscription_cycles")
      .select("id, credits_allowed")
      .eq("subscription_id", subscriptionId),
  ]);
  const granted = ((grants ?? []) as Record<string, unknown>[]).reduce(
    (n, g) => n + Number(g.credits ?? 0),
    0,
  );
  if (granted === 0) return 0;

  const rows = (cycles ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return granted;
  const { data: work } = await db
    .from("order_deliverables")
    .select("cycle_id, credit_cost, cancelled_at")
    .in("cycle_id", rows.map((c) => String(c.id)));

  const spentByCycle = new Map<string, number>();
  for (const w of (work ?? []) as Record<string, unknown>[]) {
    if (w.cancelled_at) continue;
    const key = String(w.cycle_id);
    spentByCycle.set(key, (spentByCycle.get(key) ?? 0) + Number(w.credit_cost ?? 0));
  }
  const overflow = rows.reduce((n, c) => {
    const spent = spentByCycle.get(String(c.id)) ?? 0;
    return n + Math.max(0, spent - Number(c.credits_allowed ?? 0));
  }, 0);
  return Math.max(0, granted - overflow);
}
