/*
 * The demo client: one account carrying a bit of everything, so any screen
 * can be checked against real-looking data without touching a real client.
 *
 *   npx tsx scripts/seed-demo-client.ts           create it if it is not there
 *   npx tsx scripts/seed-demo-client.ts --reset   wipe it and build it again
 *   npx tsx scripts/seed-demo-client.ts --remove  wipe it and stop
 *
 * Two rules this script never breaks.
 *
 * Every amount is zero. The demo account must never move the revenue
 * numbers, so a screen showing money stays true whether or not it is here.
 * Order and video COUNTS do include it, which is the trade: you cannot have
 * a testable order without an order existing.
 *
 * It only ever touches rows belonging to the demo email. Every delete below
 * is scoped to it, and the reset is why: a testing account you cannot put
 * back to a known state stops being useful the first time somebody
 * half-finishes something on it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { planDeliverables } from "../lib/deliverables";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const EMAIL = "shariful@ghlvideo.com";
const NAME = "Shariful Islam";
const COMPANY = "GHL Video (demo account)";
const PHONE = "+1 555 0100";

const db: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const forward = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const say = (s: string) => console.log(s);

/* Everything the demo owns carries this, so a human reading a row in the
 * database can tell at a glance that it is not a real client's work. */
const DEMO = { demo: true, seeded_by: "seed-demo-client" };

/*
 * Insert many rows, and never quietly lose one.
 *
 * Two things this exists for, both learned here.
 *
 * A multi-row insert builds ONE column list from the union of the rows, so a
 * key present on one row and absent on another arrives as NULL rather than
 * taking the column default, and a NOT NULL column then rejects the whole
 * batch. Squaring the rows off with nulls does not help for exactly the same
 * reason, so ragged rows go in one at a time instead and each keeps its own
 * defaults.
 *
 * And it throws. The first version of this script checked none of these, so
 * three rows vanished and the seed still reported success.
 */
async function insertOne(table: string, row: Record<string, unknown>) {
  const { error } = await db.from(table).insert(row);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function insertAll(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const shape = Object.keys(rows[0]).sort().join(",");
  const ragged = rows.some((r) => Object.keys(r).sort().join(",") !== shape);
  if (ragged) {
    for (const r of rows) await insertOne(table, r);
    return;
  }
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}

/* ---------------------------------------------------------------- wipe --- */

async function wipe() {
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .ilike("email", EMAIL)
    .maybeSingle();

  const { data: orders } = await db.from("orders").select("id").ilike("customer_email", EMAIL);
  const orderIds = (orders ?? []).map((o) => o.id as string);

  const { data: projects } = await db.from("projects").select("id").ilike("customer_email", EMAIL);
  const projectIds = (projects ?? []).map((p) => p.id as string);

  const { data: subs } = await db
    .from("subscriptions")
    .select("id")
    .ilike("customer_email", EMAIL);
  const subIds = (subs ?? []).map((s) => s.id as string);

  const { data: cycles } = subIds.length
    ? await db.from("subscription_cycles").select("id").in("subscription_id", subIds)
    : { data: [] };
  const cycleIds = ((cycles ?? []) as { id: string }[]).map((c) => c.id);

  /* videos first: they hang off all three owners */
  for (const [col, ids] of [
    ["order_id", orderIds],
    ["project_id", projectIds],
    ["cycle_id", cycleIds],
  ] as const) {
    if (ids.length) await db.from("order_deliverables").delete().in(col, ids);
  }

  const { data: convos } = await db
    .from("conversations")
    .select("id")
    .ilike("customer_email", EMAIL);
  const convoIds = ((convos ?? []) as { id: string }[]).map((c) => c.id);
  if (convoIds.length) await db.from("messages").delete().in("conversation_id", convoIds);
  await db.from("conversations").delete().ilike("customer_email", EMAIL);

  if (orderIds.length) {
    await db.from("order_events").delete().in("order_id", orderIds);
    await db.from("order_updates").delete().in("order_id", orderIds);
  }
  if (cycleIds.length) await db.from("subscription_cycles").delete().in("id", cycleIds);

  await db.from("subscription_payments").delete().ilike("customer_email", EMAIL);
  await db.from("subscriptions").delete().ilike("customer_email", EMAIL);
  await db.from("invoices").delete().ilike("customer_email", EMAIL);
  await db.from("orders").delete().ilike("customer_email", EMAIL);
  await db.from("projects").delete().ilike("customer_email", EMAIL);
  await db.from("editing_style_guides").delete().ilike("customer_email", EMAIL);
  if (customer) await db.from("brand_kits").delete().eq("customer_id", customer.id);
  await db.from("customers").delete().ilike("email", EMAIL);
  /* the demo's own throwaway invoice products, never a real one */
  await db.from("products").delete().like("sku", "inv-demo-%");

  /* The login is deliberately left alone. Deleting and remaking it would
   * throw away the password whoever is testing has already set. */
  say(`Wiped everything belonging to ${EMAIL}. The portal login is left as it is.`);
}

/* --------------------------------------------------------------- build --- */

/* An invoice carries its own throwaway product, the way the real ones do.
 * Made if it is missing so the seed does not depend on one existing. */
async function ensureInvoiceProduct(sku: string, name: string): Promise<string> {
  const { data: existing } = await db.from("products").select("id").eq("sku", sku).maybeSingle();
  if (existing) return String(existing.id);
  const { data, error } = await db
    .from("products")
    .insert({ sku, name, price_cents: 0, active: false, metadata: { invoice: true, ...DEMO } })
    .select("id")
    .single();
  if (error) throw new Error(`products ${sku}: ${error.message}`);
  return String(data.id);
}

async function productBySku(sku: string) {
  const { data } = await db
    .from("products")
    .select("id, sku, name, metadata")
    .eq("sku", sku)
    .maybeSingle();
  if (!data) throw new Error(`no product row for ${sku}. Run Sync from catalog first.`);
  return data;
}

/** One order, free, with its videos expanded exactly as a real one would be. */
async function makeOrder(opts: {
  sku: string;
  customerId: string;
  stage: string;
  paidDaysAgo: number;
  intakeDone: boolean;
  invoiceNumber: string;
  statuses?: (row: number, total: number) => string;
}) {
  const product = await productBySku(opts.sku);
  const { data: order, error } = await db
    .from("orders")
    .insert({
      product_id: product.id,
      customer_id: opts.customerId,
      customer_email: EMAIL,
      amount_cents: 0,
      currency: "usd",
      status: "paid",
      fulfillment_stage: opts.stage,
      intake_completed: opts.intakeDone,
      intake_completed_at: opts.intakeDone ? days(opts.paidDaysAgo - 1) : null,
      invoice_number: opts.invoiceNumber,
      created_at: days(opts.paidDaysAgo),
      paid_at: days(opts.paidDaysAgo),
      stage_changed_at: days(Math.max(0, opts.paidDaysAgo - 3)),
      metadata: { ...DEMO, sku: opts.sku },
    })
    .select("id")
    .single();
  if (error) throw new Error(`${opts.sku}: ${error.message}`);

  const plan = await planDeliverables(db, opts.sku);
  if (plan.length) {
    await insertAll(
      "order_deliverables",
      plan.map((p, i) => ({
        order_id: order.id,
        catalog_code: p.catalog_code,
        title: p.title,
        category: p.category,
        group_label: p.group_label,
        position: p.position,
        status: opts.statuses ? opts.statuses(i, plan.length) : "queued",
        /* a watchable status needs something to watch, or the portal shows a
         * Review button that opens nothing */
        video_url:
          opts.statuses && ["ready", "revisions", "approved"].includes(opts.statuses(i, plan.length))
            ? "https://cdn.ghlvideo.com/demo/sample.mp4"
            : null,
        due_at: forward(3 + i),
      })),
    );
  }

  await insertAll("order_events", [
    { order_id: order.id, event_type: "paid", payload: { ...DEMO, amount_cents: 0 } },
    { order_id: order.id, event_type: "fulfilled", payload: { ...DEMO, stage: opts.stage } },
  ]);

  say(`  order ${opts.invoiceNumber}: ${product.name}, ${plan.length} video(s), ${opts.stage}`);
  return order.id as string;
}

async function build() {
  say(`Building the demo client, ${EMAIL}.`);

  const { data: customer, error: cErr } = await db
    .from("customers")
    .insert({
      email: EMAIL,
      name: NAME,
      company: COMPANY,
      phone: PHONE,
      tags: ["demo"],
      created_at: days(120),
    })
    .select("id")
    .single();
  if (cErr) throw new Error(`customer: ${cErr.message}`);
  const customerId = customer.id as string;
  say("  customer row");

  /*
   * Portal access, the same way a real buyer gets it: the account exists with
   * NO password, exactly as ensureAuthAccount leaves one when checkout did
   * not collect a password. Set it from the sign-in page with Forgot
   * password. Nothing here ever writes or handles a password.
   */
  const { error: authErr } = await db.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
  });
  if (authErr && !/already|exist|registered/i.test(authErr.message)) {
    say(`  portal login not created: ${authErr.message}`);
  } else {
    say(`  portal login (no password: use Forgot password at /portal to set one)`);
  }

  await insertOne("brand_kits", {
    customer_id: customerId,
    brand_name: "GHL Video",
    primary_color: "#FCC000",
    accent_color: "#0090FC",
    pronunciation: "G H L Video",
    notes: "Demo brand kit. Gold leads, blue supports, never green on its own.",
  });
  say("  brand kit");

  /* three shapes of premade order, at three different stages, so the board
     and My Videos both have something in every column */
  const delivered = await makeOrder({
    sku: "demo-003",
    customerId,
    stage: "delivered",
    paidDaysAgo: 90,
    intakeDone: true,
    invoiceNumber: "DEMO-0001",
    statuses: () => "approved",
  });

  await makeOrder({
    sku: "pack-001",
    customerId,
    stage: "production",
    paidDaysAgo: 21,
    intakeDone: true,
    invoiceNumber: "DEMO-0002",
    /* a pack part way through: some signed off, one waiting on them, one
       being changed, the rest still to do */
    statuses: (i) =>
      i === 0 ? "approved" : i === 1 ? "ready" : i === 2 ? "revisions" : i < 5 ? "in_production" : "queued",
  });

  await makeOrder({
    sku: "pack-003",
    customerId,
    stage: "intake",
    paidDaysAgo: 4,
    intakeDone: false,
    invoiceNumber: "DEMO-0003",
  });

  /* an add-on invoiced against the delivered order: extra work on finished
     work, which is not a new project and must never read as one */
  await insertOne("invoices", {
    number: "DEMO-INV-01",
    token: crypto.randomUUID(),
    /* an invoice carries its own throwaway sku, the way the real ones do */
    product_sku: "inv-demo-addon",
    customer_name: NAME,
    customer_email: EMAIL,
    customer_company: COMPANY,
    line_items: [{ label: "Niche customisation on the delivered walkthrough", amount_cents: 0 }],
    currency: "usd",
    total_cents: 0,
    /* open or void are the only two states an invoice has: it is settled by
     * the order that checkout creates when somebody pays it, not by a status
     * on the invoice itself */
    status: "open",
    parent_order_id: delivered,
    notes: "Demo add-on. Zero value on purpose.",
    created_at: days(60),
    sent_at: days(60),
  });

  /*
   * And the order that settles it.
   *
   * An invoice is paid when an order exists against its throwaway sku, which
   * is the same test the portal and admin both make. Seeding one settled and
   * one outstanding means Orders and Invoices exercises both halves: the
   * thing they still owe at the top, and the paid add-on in the record below.
   */
  const addOnProduct = await ensureInvoiceProduct(
    "inv-demo-addon",
    "Niche customisation on the delivered walkthrough",
  );
  await insertOne("orders", {
    product_id: addOnProduct,
    customer_id: customerId,
    customer_email: EMAIL,
    amount_cents: 0,
    currency: "usd",
    status: "paid",
    fulfillment_stage: "delivered",
    intake_completed: true,
    invoice_number: "DEMO-INV-01",
    created_at: days(59),
    paid_at: days(59),
    stage_changed_at: days(59),
    metadata: { ...DEMO, sku: "inv-demo-addon", add_on_for: delivered },
  });
  say("  add-on invoice, paid, plus an unpaid one below");

  /* a custom project, with its own videos and its own invoice */
  const { data: project } = await db
    .from("projects")
    .insert({
      customer_id: customerId,
      customer_email: EMAIL,
      title: "Demo brand film, 90 seconds",
      brief:
        "A demo custom project. Ninety seconds, their footage plus our motion, one round of script before the edit.",
      status: "review",
      quoted_cents: 0,
      agreed_cents: 0,
      due_at: forward(10),
      created_at: days(35),
    })
    .select("id")
    .single();

  await insertAll("order_deliverables", [
    {
      project_id: project!.id,
      title: "Brand film, master cut",
      position: 0,
      status: "ready",
      video_url: "https://cdn.ghlvideo.com/demo/sample.mp4",
      /* stamped so the project's activity timeline has real movement in it,
       * not just the day it was booked */
      ready_at: days(2),
      due_at: forward(10),
    },
    {
      project_id: project!.id,
      title: "Brand film, 30 second cutdown",
      position: 1,
      status: "in_production",
      due_at: forward(14),
    },
  ]);

  await insertOne("invoices", {
    number: "DEMO-INV-02",
    token: crypto.randomUUID(),
    product_sku: "inv-demo-project",
    customer_name: NAME,
    customer_email: EMAIL,
    customer_company: COMPANY,
    line_items: [{ label: "Demo brand film, 90 seconds", amount_cents: 0 }],
    currency: "usd",
    total_cents: 0,
    status: "open",
    project_id: project!.id,
    due_date: forward(7),
    created_at: days(35),
    sent_at: days(35),
  });
  say("  custom project with two videos, plus an unpaid invoice against it");

  /* the editing plan, its months, and work in every column of the board */
  const plan = await productBySku("editing-growth");
  const renews = forward(11);
  const { data: sub } = await db
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      customer_email: EMAIL,
      product_id: plan.id,
      stripe_subscription_id: `sub_demo_${Date.now().toString(36)}`,
      status: "active",
      plan_name: "Editing: Growth",
      amount_cents: 0,
      currency: "usd",
      interval: "month",
      current_period_end: renews,
      cancel_at_period_end: false,
      metadata: { ...DEMO, sku: "editing-growth" },
      created_at: days(75),
    })
    .select("id")
    .single();

  const monthStart = (endIso: string) => {
    const d = new Date(endIso);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString();
  };
  const lastEnd = new Date(new Date(renews).getTime() - 30 * 86_400_000).toISOString();

  const { data: months } = await db
    .from("subscription_cycles")
    .insert([
      {
        subscription_id: sub!.id,
        period_start: monthStart(renews),
        period_end: renews,
        long_form_allowed: 4,
        short_form_allowed: 8,
        plan_sku: "editing-growth",
      },
      {
        subscription_id: sub!.id,
        period_start: monthStart(lastEnd),
        period_end: lastEnd,
        long_form_allowed: 4,
        short_form_allowed: 8,
        plan_sku: "editing-growth",
      },
    ])
    .select("id, period_start")
    .order("period_start", { ascending: false });

  const thisMonth = months![0].id as string;
  const lastMonth = months![1].id as string;

  /* one request in every column, so the board is never empty anywhere */
  await insertOne("order_deliverables", {
      cycle_id: thisMonth,
      title: "September webinar, cut for YouTube",
      note: "Trim the first two minutes of small talk, captions throughout, our intro on the front.",
      form: "long",
      aspect: "16:9",
      target_seconds: 720,
      status: "queued",
      assets_url: "https://drive.google.com/demo-footage-not-shared-yet",
      requested_due_at: forward(6),
      requested_at: days(1),
      position: 0,
      /* deliberately no assets_ready_at: this is the Needs footage card */
  });

  await insertOne("order_deliverables", {
      cycle_id: thisMonth,
      title: "Product update, August",
      note: "Tight cut, zooms on the three new features, music low under the voice.",
      form: "long",
      aspect: "16:9",
      target_seconds: 480,
      status: "in_production",
      assets_url: "https://drive.google.com/demo-footage",
      reference_url: "https://youtube.com/watch?v=demo",
      assets_ready_at: days(2),
      assigned_admin_email: "shariful@vidiosa.com",
      requested_due_at: forward(3),
      requested_at: days(3),
      due_at: forward(2),
      position: 1,
      qc: { audio: true, captions: true },
  });

  /* a long form with its short cuts, which is the case worth testing most:
     each cut is a video of its own with its own slot and its own approval */
  const { data: parent } = await db
    .from("order_deliverables")
    .insert({
      cycle_id: thisMonth,
      title: "Founder interview, full episode",
      note: "Two cameras, cut on the answers. Remove the question repeats.",
      form: "long",
      aspect: "16:9",
      target_seconds: 900,
      status: "ready",
      assets_url: "https://drive.google.com/demo-interview",
      assets_ready_at: days(8),
      assigned_admin_email: "shariful@vidiosa.com",
      requested_due_at: days(2),
      due_at: days(1),
      requested_at: days(9),
      video_url: "https://cdn.ghlvideo.com/demo/sample.mp4",
      ready_at: days(1),
      position: 2,
      qc: { audio: true, captions: true, brand: true, format: true, topTail: true, export: true },
    })
    .select("id")
    .single();

  await insertAll("order_deliverables", [
    {
      cycle_id: thisMonth,
      parent_id: parent!.id,
      title: "Founder interview, full episode, short cut 1",
      note: "The bit about pricing, around 4 to 6 minutes.",
      form: "short",
      aspect: "9:16",
      status: "approved",
      assets_url: "https://drive.google.com/demo-interview",
      assets_ready_at: days(8),
      video_url: "https://cdn.ghlvideo.com/demo/sample.mp4",
      approved_at: days(1),
      ready_at: days(2),
      position: 3,
      qc: { audio: true, captions: true, brand: true, format: true, topTail: true, export: true },
    },
    {
      cycle_id: thisMonth,
      parent_id: parent!.id,
      title: "Founder interview, full episode, short cut 2",
      note: "The story about the first client, near the end.",
      form: "short",
      aspect: "9:16",
      status: "revisions",
      revision_round: 1,
      assets_url: "https://drive.google.com/demo-interview",
      assets_ready_at: days(8),
      video_url: "https://cdn.ghlvideo.com/demo/sample.mp4",
      ready_at: days(3),
      position: 4,
      qc: { audio: true, captions: true, brand: true, format: true, topTail: true, export: true },
    },
    {
      /* one cancelled, so the returned-slot behaviour has something to show */
      cycle_id: thisMonth,
      title: "Ad cut we changed our mind about",
      note: "Pulled back before anyone started.",
      form: "short",
      aspect: "1:1",
      status: "queued",
      assets_url: "https://drive.google.com/demo-ad",
      cancelled_at: days(5),
      cancelled_reason: "You pulled this one back, so the slot went straight back to your month.",
      requested_at: days(6),
      position: 5,
    },
  ]);

  /* last month, finished, so Earlier months and the plan history have data */
  await insertAll("order_deliverables", [
    {
      cycle_id: lastMonth,
      title: "July webinar replay",
      form: "long",
      status: "approved",
      assets_ready_at: days(40),
      video_url: "https://cdn.ghlvideo.com/demo/sample.mp4",
      approved_at: days(34),
      position: 0,
    },
    {
      cycle_id: lastMonth,
      title: "July highlights, vertical",
      form: "short",
      status: "approved",
      assets_ready_at: days(40),
      video_url: "https://cdn.ghlvideo.com/demo/sample.mp4",
      approved_at: days(33),
      position: 1,
    },
  ]);

  say(`  editing plan with two months and ${6} requests, including a long form with two cuts`);

  /* two free charges, so the plan page has a payment history to render */
  await insertAll("subscription_payments", [
    {
      subscription_id: sub!.id,
      customer_email: EMAIL,
      amount_cents: 0,
      currency: "usd",
      stripe_payment_intent_id: `pi_demo_${Date.now().toString(36)}_1`,
      plan_name: "Editing: Growth",
      paid_at: days(49),
    },
    {
      subscription_id: sub!.id,
      customer_email: EMAIL,
      amount_cents: 0,
      currency: "usd",
      stripe_payment_intent_id: `pi_demo_${Date.now().toString(36)}_2`,
      plan_name: "Editing: Growth",
      paid_at: days(19),
    },
  ]);

  await insertOne("editing_style_guides", {
    customer_email: EMAIL,
    intro_outro: "Four second animated intro from the brand folder. No outro, end on the last line.",
    caption_style:
      "Always on. Big, centred, one or two words at a time, white with a gold highlight on the key word.",
    music: "Low and modern, under the voice. Nothing corporate or upbeat stock.",
    pacing: "Tight. Cut every pause and filler word. Zooms on the important lines, nothing gimmicky.",
    broll: "Use our HighLevel screen recordings whenever a feature is named.",
    avoid: "No meme sound effects. Never show a dashboard with a real client name in it.",
    notes: "Say Vidiosa as vid ee OH sa.",
    default_aspect: "16:9",
    updated_by: EMAIL,
  });
  say("  editing style guide, filled in");

  /* a conversation, so Messages is not empty either */
  const { data: convo } = await db
    .from("conversations")
    .insert({
      customer_email: EMAIL,
      customer_id: customerId,
      order_id: delivered,
      last_message_at: days(2),
      last_message_preview: "Looks great, thank you.",
      last_sender_role: "customer",
    })
    .select("id")
    .single();

  await insertAll("messages", [
    {
      conversation_id: convo!.id,
      sender_role: "studio",
      sender_name: "The studio",
      body: "Your walkthrough is ready. Have a watch and let us know.",
      created_at: days(3),
    },
    {
      conversation_id: convo!.id,
      sender_role: "customer",
      sender_name: NAME,
      body: "Looks great, thank you.",
      created_at: days(2),
    },
  ]);
  say("  one conversation with two messages");

  /* a general thread too, plus updates on the pack order, so the unified
   * inbox has every kind of thing to merge: chat, emails, and updates */
  const { data: general } = await db
    .from("conversations")
    .insert({
      customer_email: EMAIL,
      customer_id: customerId,
      order_id: null,
      last_message_at: days(1),
      last_message_preview: "Quick question about bundles.",
      last_sender_role: "customer",
    })
    .select("id")
    .single();
  await insertOne("messages", {
    conversation_id: general!.id,
    sender_role: "customer",
    sender_name: NAME,
    body: "Quick question about bundles.",
    created_at: days(1),
  });

  const { data: packOrder } = await db
    .from("orders")
    .select("id")
    .eq("invoice_number", "DEMO-0002")
    .single();
  /* the updates need a thread to merge into: the unified inbox shows an
     order's updates inside that order's conversation */
  const { data: packThread } = await db
    .from("conversations")
    .insert({
      customer_email: EMAIL,
      customer_id: customerId,
      order_id: packOrder!.id,
      last_message_at: days(6),
      last_message_preview: "Kicking off your pack this week.",
      last_sender_role: "studio",
    })
    .select("id")
    .single();
  await insertOne("messages", {
    conversation_id: packThread!.id,
    sender_role: "studio",
    sender_name: "The studio",
    body: "Kicking off your pack this week.",
    created_at: days(15),
  });
  await insertAll("order_updates", [
    {
      order_id: packOrder!.id,
      body: "First three videos are in production. The explainer leads.",
      created_at: days(14),
    },
    {
      order_id: packOrder!.id,
      body: "The master explainer is ready for your review.",
      created_at: days(6),
    },
  ]);
  say("  a general thread and two order updates, for the unified inbox");

  say("");
  say(`Done. ${EMAIL} now has 3 orders, 1 custom project, 1 editing plan with`);
  say("two months of work, a brand kit, a style guide, two invoices and a chat.");
  say("Every amount is zero, so no revenue number moved.");
}

/* ---------------------------------------------------------------- main --- */

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const remove = args.includes("--remove");

  if (reset || remove) await wipe();
  if (remove) return;

  const { data: existing } = await db
    .from("customers")
    .select("id")
    .ilike("email", EMAIL)
    .maybeSingle();
  if (existing) {
    say(`${EMAIL} already exists. Use --reset to rebuild it, or --remove to delete it.`);
    return;
  }

  await build();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
