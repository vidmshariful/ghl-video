import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { editingPlans } from "@/lib/content/premade";
import { cycleWindow, type Allowance } from "@/lib/subscription-slots";

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

/** What a plan sku promises each month, from the catalogue. */
export function allowanceFor(sku: string | null): Allowance {
  const plan = editingPlans.find((p) => p.sku === sku);
  return { longForm: plan?.longForm ?? 0, shortForm: plan?.shortForm ?? 0 };
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
  longFormAllowed: number;
  shortFormAllowed: number;
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
  const allowance = allowanceFor(sku);
  /* upsert, not insert: two tabs opening the portal at once would otherwise
   * race and one would fail on the unique pair */
  const { data: made } = await db
    .from("subscription_cycles")
    .upsert(
      {
        subscription_id: sub.id,
        period_start: periodStart,
        period_end: end.toISOString(),
        long_form_allowed: allowance.longForm,
        short_form_allowed: allowance.shortForm,
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
    longFormAllowed: Number(r.long_form_allowed),
    shortFormAllowed: Number(r.short_form_allowed),
    planSku: (r.plan_sku as string | null) ?? null,
  };
}
