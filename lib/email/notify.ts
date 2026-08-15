import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import { DEFAULT_TEMPLATES, SITE_URL, escapeHtml, renderTemplate, wrapEmail } from "./templates";
import { pushNotification, pushAdminNotifications } from "@/lib/notifications";

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
): Promise<boolean> {
  try {
    if (!to) return false;
    const tpl = await loadTemplate(db, key);
    if (!tpl || !tpl.enabled) return false;
    const result = await sendEmail({
      to,
      toName,
      subject: renderTemplate(tpl.subject, vars),
      html: wrapEmail(renderTemplate(tpl.body, vars)),
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
    productName: (o.products?.name as string | null) ?? "your order",
    code: (o.products?.metadata?.code ?? o.products?.sku?.toUpperCase() ?? "") as string,
    amountCents: o.amount_cents as number,
    currency: (o.currency as string | null) ?? "usd",
    deliveryUrl: (o.delivery_url as string | null) ?? "",
  };
}

/* ---- customer emails ---- */

/** Paid order confirmation + the team's new-order alert. Called from the
 *  settle flip, which already guarantees exactly-once. */
export async function sendOrderPaidEmails(db: SupabaseClient, orderId: string): Promise<void> {
  const o = await orderFor(db, orderId);
  if (!o) return;
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

/** Delivery email, sent when the stage first moves to Delivered. Project
 *  progress also goes to the customer's team members who can see orders;
 *  money emails (confirmation, refunds) stay with the owner alone. */
export async function sendOrderDeliveredEmail(db: SupabaseClient, orderId: string): Promise<void> {
  const o = await orderFor(db, orderId);
  if (!o) return;
  const vars = {
    customer_name: escapeHtml(o.name || "there"),
    product_name: escapeHtml(o.productName),
    order_code: escapeHtml(o.code),
    delivery_url: escapeHtml(o.deliveryUrl || `${SITE_URL}/portal`),
    portal_url: `${SITE_URL}/portal`,
  };
  await sendTemplate(db, "order_delivered", o.email, o.name, vars);
  const { teamRecipients } = await import("@/lib/account-team");
  const team = (await teamRecipients(db, "customer", o.email, "orders")).filter(
    (e) => e !== o.email.toLowerCase(),
  );
  for (const memberEmail of team) {
    await sendTemplate(db, "order_delivered", memberEmail, null, {
      ...vars,
      customer_name: escapeHtml("there"),
    });
  }
  await pushNotification(db, {
    audience: "customer",
    email: o.email,
    kind: "order_delivered",
    title: "Your videos are delivered",
    body: `${o.productName} is ready. Grab your files.`,
    href: `orders/${orderId}`,
    feature: "orders",
  });
}

/** Refund confirmation, from the exactly-once refund flip. */
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
