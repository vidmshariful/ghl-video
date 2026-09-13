/*
 * Move the legacy invoices into HighLevel, once.
 *
 *   npm run hl:migrate-invoices              rehearse on staging (test accounts only, by the allowlist)
 *   npm run hl:migrate-invoices -- --email   also have HighLevel email the open ones their new pay link
 *   GHLV_ENV=prod npm run hl:migrate-invoices -- --email      at go-live, on the owner's word
 *
 * A legacy invoice is one billed through a throwaway product and paid on
 * our checkout. Each becomes a HighLevel invoice on the client's contact:
 * a paid one is recorded as paid (card, with the Stripe reference) so the
 * client's billing history lives in HighLevel; an open one is sent from
 * HighLevel (marked sent, or emailed with --email) so its pay link is
 * HighLevel's. Void ones are left alone. Idempotent: an invoice that already
 * has its HighLevel id is skipped, so a second run only finishes what a
 * first one could not.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadHlConfig } from "../lib/highlevel/config";
import { hlFetch, locationId } from "../lib/highlevel/client";
import { contactOf, dollars, invoicePayload, invoiceStateFrom, liveMode, senderUserId } from "../lib/highlevel/money";
import { syncCustomer, syncAllowed } from "../lib/highlevel/sync";

for (const line of readFileSync(process.env.GHLV_ENV === "prod" ? ".env.prod.local" : ".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HIGHLEVEL_API_TOKEN and HIGHLEVEL_LOCATION_ID.");
  process.exit(1);
}
const email = process.argv.includes("--email");
const db = createClient(url, key, { auth: { persistSession: false } });
type Row = Record<string, unknown>;

(async () => {
  const cfg = await loadHlConfig(db, locationId());
  if (!cfg) {
    console.error("HighLevel is not provisioned for this location: npm run hl:provision first.");
    process.exit(1);
  }
  const { data } = await db
    .from("invoices")
    .select("*")
    .not("product_id", "is", null)
    .is("hl_invoice_id", null)
    .neq("status", "void")
    .order("created_at");
  const rows = (data ?? []) as Row[];
  console.log(`\nMIGRATE INVOICES -> HighLevel ${cfg.locationId}: ${rows.length} legacy ${rows.length === 1 ? "invoice" : "invoices"}\n`);
  let moved = 0;
  for (const inv of rows) {
    const number = String(inv.number);
    const clientEmail = String(inv.customer_email ?? "").toLowerCase();
    if (!clientEmail || !syncAllowed(clientEmail)) {
      console.log(`  skip  ${number}  ${clientEmail || "no email"} is outside HIGHLEVEL_SYNC_ALLOW`);
      continue;
    }
    const { data: customer } = await db.from("customers").select("*").ilike("email", clientEmail).maybeSingle();
    if (!customer) {
      console.log(`  skip  ${number}  no customer row for ${clientEmail}`);
      continue;
    }
    /* the contact first, through the same sync the cron runs */
    let contactId = String(customer.highlevel_contact_id ?? "");
    const { data: link } = await db
      .from("hl_links")
      .select("hl_id")
      .eq("kind", "customer")
      .eq("entity_id", String(customer.id))
      .eq("hl_kind", "contact")
      .eq("location_id", cfg.locationId)
      .maybeSingle();
    if (link) contactId = String(link.hl_id);
    else {
      const out = await syncCustomer(db, cfg, String(customer.id));
      const { data: again } = await db
        .from("hl_links")
        .select("hl_id")
        .eq("kind", "customer")
        .eq("entity_id", String(customer.id))
        .eq("hl_kind", "contact")
        .eq("location_id", cfg.locationId)
        .maybeSingle();
      if (!again) {
        console.log(`  skip  ${number}  contact could not be made: ${out.note}`);
        continue;
      }
      contactId = String(again.hl_id);
    }

    /* the order that paid it, if one did */
    const { data: order } = await db
      .from("orders")
      .select("id, paid_at, stripe_payment_intent_id, amount_cents")
      .eq("product_id", String(inv.product_id))
      .eq("status", "paid")
      .maybeSingle();

    const payload = invoicePayload(inv, contactOf(customer, contactId), cfg);
    const made = await hlFetch("/invoices/", { method: "POST", body: JSON.stringify(payload) });
    const hlId = String(made._id ?? made.id);
    let hl: Row = made;
    let note = "";
    if (order) {
      const pi = typeof order.stripe_payment_intent_id === "string" ? order.stripe_payment_intent_id : "";
      const paid = await hlFetch(`/invoices/${hlId}/record-payment`, {
        method: "POST",
        body: JSON.stringify({
          altId: cfg.locationId,
          altType: "location",
          mode: "card",
          notes: `Paid on ghlvideo.com on ${String(order.paid_at).slice(0, 10)}${pi ? `, Stripe ${pi}` : ""}`,
          amount: dollars(Number(order.amount_cents ?? inv.total_cents)),
        }),
      });
      hl = (paid.invoice as Row) ?? made;
      note = `paid ${String(order.paid_at).slice(0, 10)}`;
    } else {
      const userId = senderUserId();
      if (userId) {
        const sent = await hlFetch(`/invoices/${hlId}/send`, {
          method: "POST",
          body: JSON.stringify({ altId: cfg.locationId, altType: "location", userId, action: email ? "email" : "send_manually", liveMode: liveMode() }),
        });
        hl = (sent.invoice as Row) ?? made;
        note = email ? "open, emailed by HighLevel" : "open, marked sent";
      } else note = "open, not sent: HIGHLEVEL_USER_ID unset";
    }
    const state = invoiceStateFrom(hl);
    if (order && !state.paid_at) state.paid_at = String(order.paid_at);
    await db
      .from("invoices")
      .update({ hl_invoice_id: hlId, source: "migration", hl_sent_at: order ? null : new Date().toISOString(), ...state })
      .eq("id", String(inv.id));
    await db
      .from("hl_links")
      .upsert(
        { kind: "invoice", entity_id: String(inv.id), hl_kind: "invoice", hl_id: hlId, location_id: cfg.locationId, fingerprint: "migrated", synced_at: new Date().toISOString() },
        { onConflict: "kind,entity_id,hl_kind" },
      );
    moved += 1;
    console.log(`  moved ${number.padEnd(9)} ${clientEmail.padEnd(36)} $${(Number(inv.total_cents) / 100).toLocaleString("en-US")}  -> ${state.hl_number ?? hlId}  ${note}`);
  }
  console.log(`\n${moved} moved.\n`);
})().catch((e) => {
  console.error(`\nStopped: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
