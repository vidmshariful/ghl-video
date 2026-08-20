/*
 * Recurring payments that happened before we started recording them.
 *
 * The webhook keeps every charge from now on, but a plan that has been
 * billing for months has that history only in Stripe. This walks each
 * subscription's invoices and writes the ones that were actually paid.
 *
 * Idempotent: the table is unique on the payment intent, so running it twice
 * changes nothing. Safe to re-run after any gap in webhook delivery.
 *
 *   npx tsx scripts/backfill-subscription-payments.ts [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const dry = process.argv.includes("--dry-run");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const stripe = new Stripe(env.STRIPE_SECRET_KEY!);

async function main() {
  const { data: subs } = await db
    .from("subscriptions")
    .select("id, customer_email, plan_name, stripe_subscription_id, product:products(name)");

  let written = 0;
  let skipped = 0;

  for (const s of subs ?? []) {
    const subId = s.stripe_subscription_id as string | null;
    if (!subId) continue;

    let invoices: Stripe.Invoice[] = [];
    try {
      const list = await stripe.invoices.list({ subscription: subId, limit: 100 });
      invoices = list.data;
    } catch (e) {
      /* a test-mode id in a live account, or a subscription Stripe no longer
       * has: report it rather than failing the whole run */
      console.log(`  skip ${s.customer_email}: ${(e as Error).message.slice(0, 60)}`);
      continue;
    }

    for (const inv of invoices) {
      if (inv.status !== "paid" || !inv.amount_paid) continue;
      /*
       * The payment intent behind this invoice.
       *
       * `invoice.payment_intent` was dropped from the invoice shape in this
       * API version; the link now lives on the invoice's payments
       * sub-resource. Without an intent id there is no key to dedupe on, and
       * a row we cannot dedupe is a row that double-counts on the next run,
       * so such an invoice is skipped and counted rather than guessed at.
       */
      let intent: string | null = null;
      try {
        const pays = await stripe.invoicePayments.list({ invoice: inv.id as string, limit: 1 });
        const ref = pays.data[0]?.payment as { payment_intent?: unknown } | undefined;
        if (typeof ref?.payment_intent === "string") intent = ref.payment_intent;
      } catch {
        /* fall through to the skip below */
      }
      if (!intent) {
        skipped += 1;
        continue;
      }

      const row = {
        subscription_id: s.id as string,
        customer_email: String(s.customer_email),
        amount_cents: inv.amount_paid,
        currency: inv.currency,
        stripe_payment_intent_id: intent,
        stripe_invoice_id: inv.id,
        plan_name:
          (s.plan_name as string | null) ??
          (s.product as { name?: string } | null)?.name ??
          null,
        paid_at: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString(),
      };

      if (dry) {
        console.log(`  would write ${row.customer_email} $${(row.amount_cents / 100).toFixed(2)} ${row.paid_at.slice(0, 10)}`);
        written += 1;
        continue;
      }
      const { error } = await db
        .from("subscription_payments")
        .upsert(row, { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true });
      if (error) console.log("  error:", error.message);
      else written += 1;
    }
  }

  const { count } = await db
    .from("subscription_payments")
    .select("id", { count: "exact", head: true });

  console.log(
    `${dry ? "DRY RUN: " : ""}${written} payment(s) ${dry ? "would be" : ""} recorded` +
      (skipped ? `, ${skipped} skipped for having no payment intent to dedupe on` : "") +
      `. Table now holds ${count ?? 0}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
