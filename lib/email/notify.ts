import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import { DEFAULT_TEMPLATES, P, SITE_URL, emailButton, escapeHtml, renderTemplate, wrapEmail } from "./templates";
import { pushNotification, pushAdminNotifications } from "@/lib/notifications";
import { mayEmail, type EmailPrefs } from "./prefs";
import { logEmail } from "./log";

/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 * Every transactional email the platform sends, one helper per event, all on
 * the same rails: load the admin-editable template (DB row first, code
 * default as fallback), fill {{variables}}, wrap in the branded frame, send
 * via Brevo. Fail-soft everywhere: an email problem is logged and swallowed,
 * it NEVER breaks the money path or the action that triggered it.
 *
 * Team alerts go to ADMIN_ALERT_EMAIL (default hi@ghlvideo.com).
 */

export async function loadTemplate(db: SupabaseClient, key: string) {
  const { data } = await db
    .from("email_templates")
    .select("subject,body,enabled")
    .eq("key", key)
    .maybeSingle();
  if (data) return data as { subject: string; body: string; enabled: boolean };
  const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
  return def ? { subject: def.subject, body: def.body, enabled: true } : null;
}

/* the shared send path every helper below goes through */
async function sendTemplate(
  db: SupabaseClient,
  key: string,
  to: string,
  toName: string | null,
  vars: Record<string, string>,
  /* extra facts for the log row, e.g. which deliverable a chase was about,
     so the log can double as the chase ledger */
  meta?: Record<string, unknown>,
): Promise<boolean> {
  try {
    if (!to) return false;
    const tpl = await loadTemplate(db, key);
    if (!tpl) return false;
    if (!tpl.enabled) {
      /* an admin switched this template off; the log says so, because a
         silent skip and a failure look identical from the outside */
      await logEmail({
        to,
        toName,
        subject: renderTemplate(tpl.subject, vars),
        templateKey: key,
        source: "template",
        status: "skipped",
        error: "The template is switched off in admin",
      });
      return false;
    }

    /*
     * What this person has chosen. One gate for every client email, here
     * rather than in each helper, because a preference honoured in eleven
     * places out of twelve is not a preference.
     *
     * Money and access carry no category, so they are never held back.
     */
    const { data: who } = await db
      .from("customers")
      .select("email_prefs")
      .ilike("email", to)
      .maybeSingle();
    if (!mayEmail(key, (who?.email_prefs as EmailPrefs | null) ?? null)) {
      await logEmail({
        to,
        toName,
        subject: renderTemplate(tpl.subject, vars),
        templateKey: key,
        source: "template",
        status: "held",
        error: "Held by the client's own email preferences",
      });
      return false;
    }
    const result = await sendEmail({
      to,
      toName,
      subject: renderTemplate(tpl.subject, vars),
      html: wrapEmail(renderTemplate(tpl.body, vars)),
      log: { source: "template", templateKey: key, meta },
    });
    if (!result.ok) console.error(`[email] ${key} not sent to ${to}:`, result.error);
    return result.ok;
  } catch (e) {
    console.error(`[email] ${key} failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

const adminAlertEmail = () => process.env.ADMIN_ALERT_EMAIL ?? "hi@ghlvideo.com";

const money = (cents: number, currency = "usd") =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });

/**
 * What the buyer actually ordered, said plainly: "Marketing Video: Unified
 * Inbox" instead of the bare "Unified Inbox" (which reads like anything).
 * The type comes from the product metadata the catalog sync writes; plans
 * keep their own names, packs and bundles say what they are.
 */
export function productLabel(
  p: { name?: string | null; metadata?: Record<string, unknown> | null } | null | undefined,
): string {
  const name = (p?.name as string | null) || "your order";
  const md = (p?.metadata ?? {}) as Record<string, unknown>;
  const kind = typeof md.kind === "string" ? md.kind : null;
  const rawType =
    typeof md.video_type === "string" && md.video_type
      ? md.video_type
      : typeof md.category === "string" && md.category
        ? md.category
        : null;
  if (kind === "video") return `${rawType ? `${rawType} ` : ""}Video: ${name}`;
  if (kind === "pack")
    return `${rawType ? `${rawType} ` : "Video "}Pack: ${name}`;
  if (kind === "bundle") return `Bundle: ${name}`;
  return name;
}

/* fetch the fields every order email needs */
async function orderFor(db: SupabaseClient, orderId: string) {
  const { data } = await db
    .from("orders")
    .select(
      "id, customer_email, amount_cents, currency, delivery_url, customers(name), products(name, sku, metadata)",
    )
    .eq("id", orderId)
    .maybeSingle();
  const o = data as any;
  if (!o?.customer_email) return null;
  return {
    email: o.customer_email as string,
    name: (o.customers?.name as string | null) ?? null,
    productName: productLabel(o.products),
    code: (o.products?.metadata?.code ?? o.products?.sku?.toUpperCase() ?? "") as string,
    amountCents: o.amount_cents as number,
    currency: (o.currency as string | null) ?? "usd",
    deliveryUrl: (o.delivery_url as string | null) ?? "",
    /* the sku is how a payment is recognised as an invoice rather than an
       order: invoice products carry an inv- sku and an invoice row */
    sku: (o.products?.sku as string | null) ?? null,
  };
}

/* ---- customer emails ---- */

/** Paid order confirmation + the team's new-order alert. Called from the
 *  settle flip, which already guarantees exactly-once. */
export async function sendOrderPaidEmails(db: SupabaseClient, orderId: string): Promise<void> {
  const o = await orderFor(db, orderId);
  if (!o) return;

  /*
   * An invoice is not an order. It is work already agreed, paid against a
   * bill we sent, with no brief to fill in and no new video list to build.
   * Calling it a new order in the client's inbox and in the team's bell was
   * simply wrong, so an invoice-backed payment says what it is.
   */
  const { data: invoice } = await db
    .from("invoices")
    .select("number, total_cents, currency")
    .eq("product_sku", o.sku ?? "")
    .maybeSingle();
  if (invoice) {
    const amount = money(o.amountCents, o.currency);
    const invVars = {
      customer_name: escapeHtml(o.name || "there"),
      customer_email: escapeHtml(o.email),
      invoice_number: escapeHtml(String(invoice.number)),
      amount,
      portal_url: `${SITE_URL}/portal`,
      admin_url: `${SITE_URL}/admin`,
    };
    await sendTemplate(db, "invoice_paid", o.email, o.name, invVars);
    await sendTemplate(db, "admin_invoice_paid", adminAlertEmail(), null, invVars);
    await pushNotification(db, {
      audience: "customer",
      email: o.email,
      kind: "invoice_paid",
      title: "Payment received",
      body: `${invoice.number}, ${amount}. Thank you, nothing else is needed.`,
      href: "billing",
      feature: "orders",
    });
    await pushAdminNotifications(db, {
      kind: "invoice_paid",
      title: `Invoice payment: ${amount}`,
      body: `${invoice.number} from ${o.email}`,
      href: "invoices",
    });
    return;
  }

  const vars = {
    customer_name: escapeHtml(o.name || "there"),
    product_name: escapeHtml(o.productName),
    order_code: escapeHtml(o.code),
    amount: money(o.amountCents, o.currency),
    intake_url: `${SITE_URL}/checkout/intake/${orderId}`,
    portal_url: `${SITE_URL}/portal`,
  };
  await sendTemplate(db, "order_confirmation", o.email, o.name, vars);
  await sendTemplate(db, "admin_new_order", adminAlertEmail(), null, {
    ...vars,
    customer_email: escapeHtml(o.email),
    admin_url: `${SITE_URL}/admin`,
  });
  await pushNotification(db, {
    audience: "customer",
    email: o.email,
    kind: "order_paid",
    title: "Your order is confirmed",
    body: `${o.productName}, ${money(o.amountCents, o.currency)}. Next step: your branding brief.`,
    href: `orders/${orderId}`,
    feature: "orders",
  });
  await pushAdminNotifications(db, {
    kind: "order_paid",
    title: `New order: ${money(o.amountCents, o.currency)}`,
    body: `${o.productName} for ${o.email}`,
    href: "orders",
  });
}

/**
 * One email, re-sent by hand from a customer's record.
 *
 * Deliberately NOT sendOrderPaidEmails: that fires the admin copy and both
 * bells too, and a resend is a nudge to the client, not a fresh event for
 * the team. Returns what the log will also say, so the button that pressed
 * it can speak the truth immediately.
 */
export async function resendOrderEmail(
  db: SupabaseClient,
  orderId: string,
  kind: "order_confirmation" | "intake_reminder",
): Promise<{ ok: boolean; error?: string }> {
  const o = await orderFor(db, orderId);
  if (!o) return { ok: false, error: "Order not found." };
  const sent = await sendTemplate(db, kind, o.email, o.name, {
    customer_name: escapeHtml(o.name || "there"),
    product_name: escapeHtml(o.productName),
    order_code: escapeHtml(o.code),
    amount: money(o.amountCents, o.currency),
    intake_url: `${SITE_URL}/checkout/intake/${orderId}`,
    portal_url: `${SITE_URL}/portal`,
  });
  return sent
    ? { ok: true }
    : { ok: false, error: "Not sent. The email log has the reason." };
}

/** Delivery email, sent when the stage first moves to Delivered. Project
 *  progress also goes to the customer's team members who can see orders;
 *  money emails (confirmation, refunds) stay with the owner alone. */
/**
 * Every video on an order is approved: send the wrap-up.
 *
 * This used to be a delivery email pointing at one order level link, which
 * made sense when we handed over a folder. It does not now: the client has
 * already watched, approved and downloaded each video one at a time. So it is
 * a wrap-up instead, listing everything in one place and asking for a review
 * at the moment they are happiest.
 *
 * Exactly once is the caller's job, not this function's.
 */
export async function sendOrderDeliveredEmail(db: SupabaseClient, orderId: string): Promise<void> {
  try {
    const { data: o } = await db
      .from("orders")
      .select("id, invoice_number, customer_email, customers(name), products(name, sku, metadata)")
      .eq("id", orderId)
      .maybeSingle();
    if (!o?.customer_email) return;

    const { data: videos } = await db
      .from("order_deliverables")
      .select("title, video_url, position")
      .eq("order_id", orderId)
      .order("position");

    const rows = (videos ?? [])
      .map((v) => {
        const title = escapeHtml((v.title as string) ?? "Video");
        const url = v.video_url as string | null;
        return url
          ? `<li style="margin:0 0 8px;"><a href="${escapeHtml(url)}" style="color:#FCC000;">${title}</a></li>`
          : `<li style="margin:0 0 8px;">${title}</li>`;
      })
      .join("");
    const videoList = rows
      ? `<ul style="${P}padding-left:20px;margin:18px 0;">${rows}</ul>`
      : "";

    /* Only ask when there is somewhere to send them. An empty review button
     * is worse than no ask at all. The env var stays supported so the ask can
     * be pointed elsewhere or switched off without a deploy. */
    const { googleReviewUrl } = await import("@/lib/content/core");
    const reviewUrl = (process.env.GOOGLE_REVIEW_URL ?? googleReviewUrl ?? "").trim();
    const reviewAsk = reviewUrl
      ? `<p style="${P}margin-top:22px;">If we did right by you, a review helps us more than anything else. It takes a minute.</p>${emailButton(reviewUrl, "Leave a review")}`
      : "";

    const name = (o.customers as any)?.name ?? "there";
    await sendTemplate(db, "order_delivered", o.customer_email as string, name, {
      customer_name: escapeHtml(name),
      product_name: escapeHtml(productLabel((o.products as any) ?? null)),
      order_code: escapeHtml((o.invoice_number as string) ?? ""),
      video_list: videoList,
      review_ask: reviewAsk,
      portal_url: `${SITE_URL}/portal/videos/`,
    });
  } catch (e) {
    console.error("[email] order_complete failed:", e instanceof Error ? e.message : e);
  }
}

export async function sendOrderRefundedEmail(
  db: SupabaseClient,
  orderId: string,
  refundedCents: number,
): Promise<void> {
  const o = await orderFor(db, orderId);
  if (!o) return;
  await sendTemplate(db, "order_refunded", o.email, o.name, {
    customer_name: escapeHtml(o.name || "there"),
    product_name: escapeHtml(o.productName),
    order_code: escapeHtml(o.code),
    amount: money(refundedCents || o.amountCents, o.currency),
    portal_url: `${SITE_URL}/portal`,
  });
  const refunded = money(refundedCents || o.amountCents, o.currency);
  await pushNotification(db, {
    audience: "customer",
    email: o.email,
    kind: "order_refunded",
    title: "Your refund is on the way",
    body: `${refunded} back to your card for ${o.productName}.`,
    href: `orders/${orderId}`,
    feature: "orders",
  });
  await pushAdminNotifications(db, {
    kind: "order_refunded",
    title: `Order refunded: ${refunded}`,
    body: `${o.productName} for ${o.email}`,
    href: "orders",
  });
}

/* fetch the fields the subscription emails need */
async function subscriptionFor(db: SupabaseClient, rowId: string) {
  const { data } = await db
    .from("subscriptions")
    .select("customer_email, plan_name, amount_cents, currency, customers(name)")
    .eq("id", rowId)
    .maybeSingle();
  const s = data as any;
  if (!s?.customer_email) return null;
  return {
    email: s.customer_email as string,
    name: (s.customers?.name as string | null) ?? null,
    planName: (s.plan_name as string | null) ?? "Editing",
    amountCents: (s.amount_cents as number) ?? 0,
    currency: (s.currency as string | null) ?? "usd",
  };
}

/** First activation of an editing plan (called inside the atomic claim). */
export async function sendSubscriptionStartedEmail(db: SupabaseClient, rowId: string): Promise<void> {
  const s = await subscriptionFor(db, rowId);
  if (!s) return;
  await sendTemplate(db, "subscription_started", s.email, s.name, {
    customer_name: escapeHtml(s.name || "there"),
    plan_name: escapeHtml(s.planName),
    amount: money(s.amountCents, s.currency),
    portal_url: `${SITE_URL}/portal`,
  });
  await pushNotification(db, {
    audience: "customer",
    email: s.email,
    kind: "subscription_started",
    title: "Your editing plan is live",
    body: `${s.planName}, ${money(s.amountCents, s.currency)} monthly.`,
    href: "subscriptions",
    feature: "subscriptions",
  });
  await pushAdminNotifications(db, {
    kind: "subscription_started",
    title: `New subscription: ${s.planName}`,
    body: `${s.email}, ${money(s.amountCents, s.currency)} monthly`,
    href: "subscriptions",
  });
}

/**
 * The monthly price on a plan changed.
 *
 * Sent because a client must never discover a different amount by looking at
 * their bank statement. It says what it was, what it is, when it starts, and
 * why, and it invites them to push back before any money moves, which is the
 * only version of this email that is fair to send.
 */
export async function sendSubscriptionPriceChangedEmail(
  db: SupabaseClient,
  rowId: string,
  opts: { oldCents: number; newCents: number; effective: string; reason: string },
): Promise<void> {
  const s = await subscriptionFor(db, rowId);
  if (!s) return;
  const newAmount = money(opts.newCents, s.currency);
  await sendTemplate(db, "subscription_price_changed", s.email, s.name, {
    customer_name: escapeHtml(s.name || "there"),
    plan_name: escapeHtml(s.planName),
    old_amount: money(opts.oldCents, s.currency),
    new_amount: newAmount,
    effective_date: escapeHtml(opts.effective),
    reason: escapeHtml(opts.reason),
    portal_url: `${SITE_URL}/portal`,
  });
  await pushNotification(db, {
    audience: "customer",
    email: s.email,
    kind: "subscription_price_changed",
    title: "Your plan price is changing",
    body: `${s.planName} moves to ${newAmount} a month from ${opts.effective}.`,
    href: "subscriptions",
    feature: "subscriptions",
  });
}

/** The plan actually ended (Stripe subscription deleted). */
export async function sendSubscriptionCanceledEmail(db: SupabaseClient, rowId: string): Promise<void> {
  const s = await subscriptionFor(db, rowId);
  if (!s) return;
  await sendTemplate(db, "subscription_canceled", s.email, s.name, {
    customer_name: escapeHtml(s.name || "there"),
    plan_name: escapeHtml(s.planName),
    portal_url: `${SITE_URL}/portal`,
  });
  await pushNotification(db, {
    audience: "customer",
    email: s.email,
    kind: "subscription_canceled",
    title: "Your plan has ended",
    body: `${s.planName} is canceled. Restart anytime from your portal.`,
    href: "subscriptions",
    feature: "subscriptions",
  });
  await pushAdminNotifications(db, {
    kind: "subscription_canceled",
    title: "Subscription canceled",
    body: `${s.email}, ${s.planName}`,
    href: "subscriptions",
  });
}

/* ---- lead + partner emails ---- */

export async function sendQuoteReceivedEmail(
  db: SupabaseClient,
  email: string,
  name: string,
): Promise<void> {
  await sendTemplate(db, "quote_received", email, name || null, {
    name: escapeHtml(name || "there"),
    contact_url: `${SITE_URL}/contact`,
  });
  await pushAdminNotifications(db, {
    kind: "quote_received",
    title: "New quote request",
    body: `${name || "Someone"}, ${email}. The lead is in HighLevel.`,
  });
}

/** Applicant confirmation + the team's new-application alert. */
export async function sendPartnerApplicationEmails(
  db: SupabaseClient,
  applicant: { email: string; name: string; channel: string; audience: string },
): Promise<void> {
  await sendTemplate(db, "partner_application_received", applicant.email, applicant.name || null, {
    name: escapeHtml(applicant.name || "there"),
    partners_url: `${SITE_URL}/partners`,
  });
  await sendTemplate(db, "admin_new_application", adminAlertEmail(), null, {
    name: escapeHtml(applicant.name),
    email: escapeHtml(applicant.email),
    channel: escapeHtml(applicant.channel || "not said"),
    audience: escapeHtml(applicant.audience || "not said"),
    admin_url: `${SITE_URL}/admin`,
  });
  await pushAdminNotifications(db, {
    kind: "partner_application",
    title: "New partner application",
    body: `${applicant.name}, ${applicant.channel || "channel not said"}`,
    href: "partners",
  });
}

/** An auto-approved Tier 1 affiliate just joined: their portal is live
 *  (partner_invite carries the way in), and the team gets a heads-up. */
export async function sendAffiliateJoinedEmails(
  db: SupabaseClient,
  joined: { email: string; name: string; channel: string; audience: string },
): Promise<void> {
  await sendPartnerInviteEmail(db, { email: joined.email, name: joined.name });
  await sendTemplate(db, "admin_new_application", adminAlertEmail(), null, {
    name: escapeHtml(joined.name),
    email: escapeHtml(joined.email),
    channel: escapeHtml(joined.channel || "not said"),
    audience: escapeHtml(joined.audience || "not said"),
    admin_url: `${SITE_URL}/admin`,
  });
  await pushAdminNotifications(db, {
    kind: "partner_joined",
    title: "New affiliate partner joined",
    body: `${joined.name}, ${joined.channel || "channel not said"}. Auto-approved into Tier 1.`,
    href: "partners",
  });
}

export async function sendPartnerInviteEmail(
  db: SupabaseClient,
  partner: { email: string; name: string },
): Promise<void> {
  await sendTemplate(db, "partner_invite", partner.email, partner.name || null, {
    partner_name: escapeHtml(partner.name || "there"),
    partner_email: escapeHtml(partner.email),
    partners_url: `${SITE_URL}/partners`,
  });
  await pushNotification(db, {
    audience: "partner",
    email: partner.email,
    kind: "partner_invited",
    title: "Welcome to the partner program",
    body: "Your portal is live. Grab your links, assets, and coupon.",
    href: "dashboard",
    ownerOnly: true,
  });
}

/** A customer or partner added a teammate: email them the way in, and put
 *  the invite on their bell (personal, never fanned out). */
/**
 * A piece of a custom video is ready for the client's say: a script we
 * wrote, a voiceover we recorded, an animation draft, the final file.
 * Fired when the studio flips a pipeline station to the client's court.
 */
export async function sendApprovalRequestEmail(
  db: SupabaseClient,
  input: { email: string; name: string | null; videoTitle: string; stageLabel: string },
): Promise<void> {
  await sendTemplate(db, "approval_request", input.email, input.name, {
    customer_name: escapeHtml(input.name || "there"),
    video_title: escapeHtml(input.videoTitle),
    stage_label: escapeHtml(input.stageLabel),
    portal_url: `${SITE_URL}/portal`,
  });
}

/**
 * The hand-fired welcome for an account the studio created itself: no order,
 * no checkout, so nothing else would ever tell this person their portal
 * exists. Sent from the customer's record in admin.
 */
export async function sendPortalWelcomeEmail(
  db: SupabaseClient,
  input: { email: string; name: string | null },
): Promise<void> {
  await sendTemplate(db, "portal_welcome", input.email, input.name, {
    customer_name: escapeHtml(input.name || "there"),
    customer_email: escapeHtml(input.email),
    portal_url: `${SITE_URL}/portal`,
  });
}

/**
 * The automatic nudge when a piece has sat with the client. At most two per
 * piece, spaced out; the policy lives in lib/pipeline and the ledger is the
 * email log itself, keyed by the meta written here.
 */
export async function sendApprovalReminderEmail(
  db: SupabaseClient,
  input: {
    email: string;
    name: string | null;
    videoTitle: string;
    stageLabel: string;
    daysWaiting: number;
    deliverableId: string;
    station: string;
  },
): Promise<boolean> {
  return sendTemplate(
    db,
    "approval_reminder",
    input.email,
    input.name,
    {
      customer_name: escapeHtml(input.name || "there"),
      video_title: escapeHtml(input.videoTitle),
      stage_label: escapeHtml(input.stageLabel),
      days_waiting: String(input.daysWaiting),
      portal_url: `${SITE_URL}/portal`,
    },
    { chase: true, deliverableId: input.deliverableId, station: input.station },
  );
}

/** Monday's one-email answer to "where are my videos". */
export async function sendProjectDigestEmail(
  db: SupabaseClient,
  input: { email: string; name: string | null; linesHtml: string },
): Promise<boolean> {
  return sendTemplate(
    db,
    "project_digest",
    input.email,
    input.name,
    {
      customer_name: escapeHtml(input.name || "there"),
      digest_lines: input.linesHtml,
      portal_url: `${SITE_URL}/portal`,
    },
    { digest: true },
  );
}

export async function sendTeamInviteEmail(
  db: SupabaseClient,
  input: {
    accountType: "customer" | "partner";
    ownerName: string;
    memberName: string;
    memberEmail: string;
  },
): Promise<void> {
  const portalLabel = input.accountType === "customer" ? "customer portal" : "partner portal";
  const portalPath = input.accountType === "customer" ? "/portal" : "/partners";
  await sendTemplate(db, "team_invite", input.memberEmail, input.memberName || null, {
    member_name: escapeHtml(input.memberName || "there"),
    member_email: escapeHtml(input.memberEmail),
    owner_name: escapeHtml(input.ownerName || "The account owner"),
    portal_label: portalLabel,
    portal_url: `${SITE_URL}${portalPath}`,
  });
  await pushNotification(db, {
    audience: input.accountType,
    email: input.memberEmail,
    kind: "team_invited",
    title: `You joined ${input.ownerName || "a"} team`,
    body: `${input.ownerName || "The account owner"} added you to their ${portalLabel}.`,
    href: "dashboard",
    ownerOnly: true,
  });
}

/* ---- team alerts ---- */

export async function sendDisputeAlertEmail(
  db: SupabaseClient,
  orderId: string,
  dispute: { amountCents: number; reason: string },
): Promise<void> {
  const o = await orderFor(db, orderId);
  await sendTemplate(db, "admin_dispute", adminAlertEmail(), null, {
    customer_email: escapeHtml(o?.email ?? "unknown"),
    product_name: escapeHtml(o?.productName ?? "unknown product"),
    order_code: escapeHtml(o?.code ?? ""),
    amount: money(dispute.amountCents, o?.currency ?? "usd"),
    reason: escapeHtml(dispute.reason || "not given"),
    admin_url: `${SITE_URL}/admin`,
  });
  await pushAdminNotifications(db, {
    kind: "dispute",
    title: `Payment dispute: ${money(dispute.amountCents, o?.currency ?? "usd")}`,
    body: `${o?.email ?? "unknown"}, ${o?.productName ?? "unknown product"}. Respond in Stripe.`,
    href: "orders",
  });
}

/* ---- review emails ---------------------------------------------------- */

/** Where a client goes to watch and review their videos. */
const videosUrl = () => `${SITE_URL}/portal/videos/`;

/**
 * Tell the client one of their videos is ready to watch. Fired when the studio
 * moves a video to Ready, which is the moment the link is released to them.
 */
export async function sendVideoReadyEmail(
  db: SupabaseClient,
  deliverableId: string,
): Promise<void> {
  try {
    const { data: d } = await db
      .from("order_deliverables")
      .select("title, order_id")
      .eq("id", deliverableId)
      .maybeSingle();
    if (!d) return;
    const { data: o } = await db
      .from("orders")
      .select("customer_email, customers(name)")
      .eq("id", d.order_id)
      .maybeSingle();
    if (!o?.customer_email) return;
    const name = (o.customers as any)?.name ?? "there";
    await sendTemplate(db, "video_ready", o.customer_email as string, name, {
      customer_name: escapeHtml(name),
      video_title: escapeHtml(d.title as string),
      portal_url: videosUrl(),
    });
  } catch (e) {
    console.error("[email] video_ready failed:", e instanceof Error ? e.message : e);
  }
}

/** Tell the client the studio answered their note. */
export async function sendVideoReplyEmail(
  db: SupabaseClient,
  deliverableId: string,
  message: string,
): Promise<void> {
  try {
    const { data: d } = await db
      .from("order_deliverables")
      .select("title, order_id")
      .eq("id", deliverableId)
      .maybeSingle();
    if (!d) return;
    const { data: o } = await db
      .from("orders")
      .select("customer_email, customers(name)")
      .eq("id", d.order_id)
      .maybeSingle();
    if (!o?.customer_email) return;
    const name = (o.customers as any)?.name ?? "there";
    await sendTemplate(db, "video_reply", o.customer_email as string, name, {
      customer_name: escapeHtml(name),
      video_title: escapeHtml(d.title as string),
      message: escapeHtml(message.slice(0, 600)),
      portal_url: videosUrl(),
    });
  } catch (e) {
    console.error("[email] video_reply failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Tell the studio a client said something about a video.
 *
 * This is the one that matters operationally: feedback used to ring the bell
 * only, so if nobody had the admin open it could sit for a day. Goes to the
 * person who owns the job when there is one, and to the team alert address
 * otherwise.
 */
export async function sendVideoFeedbackAlert(
  db: SupabaseClient,
  args: {
    deliverableId: string;
    kind: "comment" | "approved" | "changes";
    customerName: string;
    message: string;
    where?: string | null;
  },
): Promise<void> {
  try {
    const { data: d } = await db
      .from("order_deliverables")
      .select("title, order_id")
      .eq("id", args.deliverableId)
      .maybeSingle();
    if (!d) return;
    const { data: o } = await db
      .from("orders")
      .select("assigned_admin_email")
      .eq("id", d.order_id)
      .maybeSingle();
    const to = (o?.assigned_admin_email as string | null) || adminAlertEmail();

    const headline =
      args.kind === "approved"
        ? `Approved: ${d.title}`
        : args.kind === "changes"
          ? `Changes requested: ${d.title}`
          : `Feedback on ${d.title}`;

    await sendTemplate(db, "admin_video_feedback", to, null, {
      headline: escapeHtml(headline),
      customer_name: escapeHtml(args.customerName),
      video_title: escapeHtml(d.title as string),
      where: args.where ? escapeHtml(` at ${args.where}`) : "",
      message: escapeHtml(args.message.slice(0, 600)),
      admin_url: `${SITE_URL}/admin/production/`,
    });
  } catch (e) {
    console.error("[email] admin_video_feedback failed:", e instanceof Error ? e.message : e);
  }
}
