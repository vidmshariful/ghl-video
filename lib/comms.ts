/*
 * Everything the platform says on its own: the map of actions to the emails
 * and in-app notifications they fire, and the default wording of every
 * notification.
 *
 * Why this exists as one list: a template key in a dropdown tells nobody when
 * it fires or who reads it. The admin screen (Emails and notifications) reads
 * this list to show the words beside the action that causes them, grouped by
 * feature, so the team can decide what to say at each moment without reading
 * code. The push layer in lib/notifications.ts reads the same defaults, so
 * there is exactly one copy of every bell's text.
 *
 * Client-safe on purpose: no server-only imports, so the admin screen can show
 * defaults, variables and previews without a round trip.
 *
 * Adding a notification: put its default here, pass `vars` at the call site,
 * and list it under the action that fires it. Adding an email: add the
 * template to lib/email/templates.ts and list it under its action here.
 */

import type { Audience } from "@/lib/notifications-types";

export type CommGroupKey =
  | "new_order"
  | "brief"
  | "premade"
  | "custom"
  | "editing"
  | "invoices"
  | "subscriptions"
  | "refunds"
  | "partners"
  | "team"
  | "offers"
  | "system";

export const COMM_GROUPS: { key: CommGroupKey; label: string; blurb: string }[] = [
  { key: "new_order", label: "New order", blurb: "A payment lands and becomes an order." },
  { key: "brief", label: "Branding brief", blurb: "The client tells us their brand, and the clock starts." },
  { key: "premade", label: "Pre-made production", blurb: "Library videos being made, reviewed and approved one by one." },
  { key: "custom", label: "Custom production", blurb: "Bespoke projects walking the six station line." },
  { key: "editing", label: "Editing plans", blurb: "Monthly editing requests and the style guide." },
  { key: "invoices", label: "Invoices", blurb: "Work billed outside checkout." },
  { key: "subscriptions", label: "Subscriptions", blurb: "Plans starting, changing price and ending." },
  { key: "refunds", label: "Refunds and disputes", blurb: "Money going back, and chargebacks." },
  { key: "partners", label: "Partner program", blurb: "Affiliates joining and being invited." },
  { key: "team", label: "Team and access", blurb: "Portal logins, teammates and welcomes." },
  { key: "offers", label: "Offers", blurb: "Promotions sent by hand." },
  { key: "system", label: "Alarms and system", blurb: "The platform telling the team something broke." },
];

/* who an email or bell is addressed to, in words the team uses */
export type CommTo = "client" | "team" | "owner" | "producer" | "partner" | "lead" | "teammate";

export const TO_LABEL: Record<CommTo, string> = {
  client: "The client",
  team: "The team alert address",
  owner: "The order owner, else every admin",
  producer: "The project's producer, else the team alert address",
  partner: "The partner",
  lead: "The person who enquired",
  teammate: "The new teammate",
};

export type CommMode = "automatic" | "manual" | "scheduled";

export type CommAction = {
  key: string;
  group: CommGroupKey;
  label: string;
  /* the plain sentence: when does this fire */
  when: string;
  mode: CommMode;
  emails: { key: string; to: CommTo; note?: string }[];
  notifications: { kind: string; audience: Audience; to: CommTo; note?: string }[];
};

export const COMM_ACTIONS: CommAction[] = [
  /* ---- new order ---- */
  {
    key: "order_paid", group: "new_order", label: "Order paid",
    when: "Stripe confirms the payment and the order flips to paid, exactly once.",
    mode: "automatic",
    emails: [{ key: "order_confirmation", to: "client" }, { key: "admin_new_order", to: "team" }],
    notifications: [{ kind: "order_paid", audience: "customer", to: "client" }, { kind: "order_paid", audience: "admin", to: "team" }],
  },
  {
    key: "order_resend", group: "new_order", label: "Resend the confirmation or the brief reminder",
    when: "A person presses Resend on the customer record. Never automatic.",
    mode: "manual",
    emails: [{ key: "order_confirmation", to: "client", note: "resend" }, { key: "intake_reminder", to: "client" }],
    notifications: [],
  },

  /* ---- brief ---- */
  {
    key: "brief_received", group: "brief", label: "Brief received",
    when: "The client submits their branding brief. Due dates are set at this moment, so the email can promise one.",
    mode: "automatic",
    emails: [{ key: "brief_received", to: "client" }],
    notifications: [{ kind: "brief_received", audience: "customer", to: "client" }, { kind: "brief_received", audience: "admin", to: "owner" }],
  },

  /* ---- pre-made ---- */
  {
    key: "video_ready", group: "premade", label: "A video is ready to review",
    when: "The studio moves a video into Ready.",
    mode: "automatic",
    emails: [{ key: "video_ready", to: "client" }],
    notifications: [],
  },
  {
    key: "video_feedback", group: "premade", label: "The client leaves a note",
    when: "A client comments on a video in the review popup, or answers the dashboard feedback ask.",
    mode: "automatic",
    emails: [{ key: "admin_video_feedback", to: "owner" }],
    notifications: [{ kind: "video_feedback", audience: "admin", to: "owner" }],
  },
  {
    key: "video_verdict", group: "premade", label: "The client approves or requests changes",
    when: "A client presses Approve or Request changes on a video.",
    mode: "automatic",
    emails: [{ key: "admin_video_feedback", to: "owner" }],
    notifications: [{ kind: "video_approved", audience: "admin", to: "owner" }, { kind: "video_changes", audience: "admin", to: "owner" }],
  },
  {
    key: "video_reply", group: "premade", label: "The studio answers a note",
    when: "Someone on the team replies to the client's note from the job page.",
    mode: "automatic",
    emails: [{ key: "video_reply", to: "client" }],
    notifications: [{ kind: "video_reply", audience: "customer", to: "client" }],
  },
  {
    key: "order_update", group: "premade", label: "The studio posts an order update",
    when: "A person posts an update on the order's timeline.",
    mode: "manual",
    emails: [{ key: "order_update", to: "client" }],
    notifications: [{ kind: "order_update", audience: "customer", to: "client" }],
  },
  {
    key: "order_delivered", group: "premade", label: "Every video approved, order complete",
    when: "The client approves the last video, or the studio moves the order to Delivered. Sent exactly once.",
    mode: "automatic",
    emails: [{ key: "order_delivered", to: "client" }],
    notifications: [{ kind: "order_completed", audience: "customer", to: "client" }, { kind: "order_completed", audience: "admin", to: "owner" }],
  },

  /* ---- custom ---- */
  {
    key: "project_request", group: "custom", label: "A custom video is requested",
    when: "A client asks for a custom video from their portal, or the website quote form is sent.",
    mode: "automatic",
    emails: [{ key: "quote_received", to: "lead", note: "website form only" }],
    notifications: [{ kind: "project_request", audience: "admin", to: "team" }, { kind: "quote_received", audience: "admin", to: "team", note: "website form" }],
  },
  {
    key: "approval_request", group: "custom", label: "A stage is handed to the client",
    when: "The studio sends a station to the client's court: a script to read, a cut to approve.",
    mode: "automatic",
    emails: [{ key: "approval_request", to: "client" }],
    notifications: [{ kind: "approval_request", audience: "customer", to: "client" }],
  },
  {
    key: "stage_feedback", group: "custom", label: "The client reviews a stage",
    when: "The client comments on a stage, approves the animation or final cut, or sends it back.",
    mode: "automatic",
    emails: [{ key: "admin_project_feedback", to: "producer" }],
    notifications: [
      { kind: "stage_feedback", audience: "admin", to: "team" },
      { kind: "stage_approved", audience: "admin", to: "team" },
      { kind: "stage_changes", audience: "admin", to: "team" },
    ],
  },
  {
    key: "client_provided", group: "custom", label: "The client supplies their script or voiceover",
    when: "A client adds the file a station was waiting on them for.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "client_provided", audience: "admin", to: "team" }],
  },
  {
    key: "project_note", group: "custom", label: "The studio writes on the project",
    when: "A note in the review room, or a message in the project thread.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "project_note", audience: "customer", to: "client" }, { kind: "message", audience: "customer", to: "client" }],
  },
  {
    key: "project_file", group: "custom", label: "A file is added to the project",
    when: "Either side adds an attachment.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "project_file", audience: "admin", to: "team" }, { kind: "project_file", audience: "customer", to: "client" }],
  },
  {
    key: "approval_reminder", group: "custom", label: "Nudge: still with the client",
    when: "Daily at 09:00 UTC. Anything sitting with the client for three full days, at most twice, three days apart. Covers custom stations, extra formats and editing cuts.",
    mode: "scheduled",
    emails: [{ key: "approval_reminder", to: "client" }],
    notifications: [],
  },
  {
    key: "project_digest", group: "custom", label: "Weekly digest",
    when: "Mondays. One email per client with a project in motion, listing where every video stands.",
    mode: "scheduled",
    emails: [{ key: "project_digest", to: "client" }],
    notifications: [],
  },

  /* ---- editing ---- */
  {
    key: "edit_requested", group: "editing", label: "The client requests an edit",
    when: "A client submits a video request on their plan.",
    mode: "automatic",
    emails: [{ key: "admin_edit_requested", to: "team" }],
    notifications: [{ kind: "edit_requested", audience: "admin", to: "team" }],
  },
  {
    key: "edit_added", group: "editing", label: "The studio adds a request for them",
    when: "Someone on the team adds an edit the client asked for outside the portal.",
    mode: "manual",
    emails: [],
    notifications: [{ kind: "edit_added", audience: "customer", to: "client" }],
  },
  {
    key: "style_guide", group: "editing", label: "The style guide is published",
    when: "The studio publishes or updates the client's style guide.",
    mode: "manual",
    emails: [],
    notifications: [{ kind: "style_guide", audience: "customer", to: "client" }],
  },
  {
    key: "style_guide_note", group: "editing", label: "The client notes the style guide",
    when: "A client pins a note to a page of the guide.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "style_guide_note", audience: "admin", to: "team" }],
  },

  /* ---- invoices ---- */
  {
    key: "invoice_sent", group: "invoices", label: "An invoice is sent",
    when: "A person marks an invoice sent in admin. The email carries the pay link.",
    mode: "manual",
    emails: [{ key: "invoice_sent", to: "client" }],
    notifications: [{ kind: "invoice_sent", audience: "customer", to: "client" }],
  },
  {
    key: "invoice_paid", group: "invoices", label: "An invoice is paid",
    when: "The pay link is used and Stripe confirms it.",
    mode: "automatic",
    emails: [{ key: "invoice_paid", to: "client" }, { key: "admin_invoice_paid", to: "team" }],
    notifications: [{ kind: "invoice_paid", audience: "customer", to: "client" }, { kind: "invoice_paid", audience: "admin", to: "team" }],
  },
  {
    key: "list_invoice_requested", group: "invoices", label: "Someone asks for an invoice from a shared list",
    when: "A visitor on a shared shortlist page asks to be invoiced.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "list_invoice_requested", audience: "admin", to: "team" }],
  },

  /* ---- subscriptions ---- */
  {
    key: "subscription_started", group: "subscriptions", label: "A plan starts",
    when: "Stripe activates the subscription.",
    mode: "automatic",
    emails: [{ key: "subscription_started", to: "client" }],
    notifications: [{ kind: "subscription_started", audience: "customer", to: "client" }, { kind: "subscription_started", audience: "admin", to: "team" }],
  },
  {
    key: "subscription_price_changed", group: "subscriptions", label: "A plan is repriced",
    when: "A person changes the monthly price from the subscription page.",
    mode: "manual",
    emails: [{ key: "subscription_price_changed", to: "client" }],
    notifications: [{ kind: "subscription_price_changed", audience: "customer", to: "client" }],
  },
  {
    key: "subscription_canceled", group: "subscriptions", label: "A plan ends",
    when: "Stripe deletes the subscription, at period end or immediately.",
    mode: "automatic",
    emails: [{ key: "subscription_canceled", to: "client" }],
    notifications: [{ kind: "subscription_canceled", audience: "customer", to: "client" }, { kind: "subscription_canceled", audience: "admin", to: "team" }],
  },

  /* ---- refunds ---- */
  {
    key: "order_refunded", group: "refunds", label: "An order is refunded in full",
    when: "From the order page or the Stripe dashboard. Partial refunds only log an event.",
    mode: "automatic",
    emails: [{ key: "order_refunded", to: "client" }],
    notifications: [{ kind: "order_refunded", audience: "customer", to: "client" }, { kind: "order_refunded", audience: "admin", to: "team" }],
  },
  {
    key: "dispute", group: "refunds", label: "A payment is disputed",
    when: "Stripe opens a chargeback.",
    mode: "automatic",
    emails: [{ key: "admin_dispute", to: "team" }],
    notifications: [{ kind: "dispute", audience: "admin", to: "team" }],
  },

  /* ---- partners ---- */
  {
    key: "partner_joined", group: "partners", label: "A partner joins",
    when: "Someone applies at /partners/apply or from their customer portal. Approved on the spot into Tier 1.",
    mode: "automatic",
    emails: [{ key: "partner_invite", to: "partner" }, { key: "admin_new_application", to: "team" }],
    notifications: [{ kind: "partner_joined", audience: "admin", to: "team" }, { kind: "partner_invited", audience: "partner", to: "partner" }],
  },
  {
    key: "partner_invited", group: "partners", label: "A partner is invited by hand",
    when: "A person presses Invite or Resend access on the admin Partners screen.",
    mode: "manual",
    emails: [{ key: "partner_invite", to: "partner" }],
    notifications: [{ kind: "partner_invited", audience: "partner", to: "partner" }],
  },
  {
    key: "partner_application", group: "partners", label: "Application received (not in use)",
    when: "Nothing calls this today: applying became instant approval. Kept in case a review step returns.",
    mode: "automatic",
    emails: [{ key: "partner_application_received", to: "partner" }],
    notifications: [{ kind: "partner_application", audience: "admin", to: "team" }],
  },

  /* ---- team ---- */
  {
    key: "portal_welcome", group: "team", label: "Welcome a client to their portal",
    when: "A person presses Send welcome on the customer record. For accounts the studio created by hand.",
    mode: "manual",
    emails: [{ key: "portal_welcome", to: "client" }],
    notifications: [],
  },
  {
    key: "team_invited", group: "team", label: "A teammate is added",
    when: "A client or partner adds someone to their portal, or a contact is given a seat from the customer record.",
    mode: "automatic",
    emails: [{ key: "team_invite", to: "teammate" }],
    notifications: [{ kind: "team_invited", audience: "customer", to: "teammate" }, { kind: "team_invited", audience: "partner", to: "teammate" }],
  },
  {
    key: "socialx_request", group: "team", label: "A client asks for their SocialX code",
    when: "The account owner presses Request my code.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "socialx_request", audience: "admin", to: "team" }, { kind: "socialx_request", audience: "customer", to: "client" }],
  },

  /* ---- offers ---- */
  {
    key: "campaign", group: "offers", label: "An offer is sent",
    when: "A person presses Send on an offer. Goes to paying clients only, once per person per offer, and honours the offers preference. Its words live on the offer itself.",
    mode: "manual",
    emails: [],
    notifications: [],
  },

  /* ---- system ---- */
  {
    key: "alarm", group: "system", label: "An alarm is raised",
    when: "The money path reports a problem: a failed webhook, an orphan payment, a price drift. Critical alarms also email every admin.",
    mode: "automatic",
    emails: [],
    notifications: [{ kind: "alarm", audience: "admin", to: "team" }],
  },
];

/* ---------- notification defaults ---------- */

export type NotificationDefault = {
  title: string;
  body: string;
  variables: string[];
};

export const notifId = (audience: Audience, kind: string) => `${audience}:${kind}`;

/*
 * The words each bell says when nobody has edited them. Variables in double
 * braces are filled at the moment it fires, from whatever the call site knows.
 * The list beside each one is what the admin editor shows.
 */
export const NOTIFICATION_DEFAULTS: Record<string, NotificationDefault> = {
  /* money */
  "customer:order_paid": { title: "Your order is confirmed", body: "{{product_name}}, {{amount}}. Next step: your branding brief.", variables: ["product_name", "amount", "order_code"] },
  "admin:order_paid": { title: "New order: {{amount}}", body: "{{product_name}} for {{customer_email}}", variables: ["product_name", "amount", "order_code", "customer_email"] },
  "customer:invoice_paid": { title: "Payment received", body: "{{invoice_number}}, {{amount}}. Thank you, nothing else is needed.", variables: ["invoice_number", "amount"] },
  "admin:invoice_paid": { title: "Invoice payment: {{amount}}", body: "{{invoice_number}} from {{customer_email}}", variables: ["invoice_number", "amount", "customer_email"] },
  "customer:invoice_sent": { title: "An invoice is ready to pay", body: "{{invoice_number}}, {{amount}}{{due_line}}.", variables: ["invoice_number", "amount", "due_line"] },
  "customer:order_update": { title: "New update on {{product_name}}", body: "{{update_message}}", variables: ["product_name", "update_message"] },
  "customer:order_refunded": { title: "Your refund is on the way", body: "{{amount}} back to your card for {{product_name}}.", variables: ["amount", "product_name"] },
  "admin:order_refunded": { title: "Order refunded: {{amount}}", body: "{{product_name}} for {{customer_email}}", variables: ["amount", "product_name", "customer_email"] },
  "admin:dispute": { title: "Payment dispute: {{amount}}", body: "{{customer_email}}, {{product_name}}. Respond in Stripe.", variables: ["amount", "customer_email", "product_name"] },
  "customer:subscription_started": { title: "Your editing plan is live", body: "{{plan_name}}, {{amount}} monthly.", variables: ["plan_name", "amount"] },
  "admin:subscription_started": { title: "New subscription: {{plan_name}}", body: "{{customer_email}}, {{amount}} monthly", variables: ["plan_name", "amount", "customer_email"] },
  "customer:subscription_price_changed": { title: "Your plan price is changing", body: "{{plan_name}} moves to {{new_amount}} a month from {{effective_date}}.", variables: ["plan_name", "new_amount", "effective_date"] },
  "customer:subscription_canceled": { title: "Your plan has ended", body: "{{plan_name}} is canceled. Restart anytime from your portal.", variables: ["plan_name"] },
  "admin:subscription_canceled": { title: "Subscription canceled", body: "{{customer_email}}, {{plan_name}}", variables: ["plan_name", "customer_email"] },

  /* brief */
  "customer:brief_received": { title: "Your brief is in", body: "We have what we need for {{product_name}}{{due_line}}.", variables: ["product_name", "due_line", "due_date"] },
  "admin:brief_received": { title: "Brief received: {{product_name}}", body: "{{customer_email}} sent their branding brief{{due_line}}.", variables: ["product_name", "customer_email", "due_line", "due_date"] },

  /* pre-made */
  "admin:video_feedback": { title: "Feedback on {{video_title}}", body: "{{summary}}", variables: ["video_title", "summary", "customer_name"] },
  "admin:video_approved": { title: "Approved: {{video_title}}", body: "{{who}} approved this video.", variables: ["video_title", "who"] },
  "admin:video_changes": { title: "Changes requested: {{video_title}}", body: "{{who}} asked for changes.", variables: ["video_title", "who"] },
  "customer:video_reply": { title: "A reply on {{video_title}}", body: "{{summary}}", variables: ["video_title", "summary"] },
  "customer:order_completed": { title: "Your order is complete", body: "Every video is approved and yours to use.", variables: ["product_name"] },
  "admin:order_completed": { title: "Finished: {{product_name}}", body: "Every video approved. The client has their wrap-up.", variables: ["product_name"] },

  /* custom */
  "admin:project_request": { title: "Custom enquiry from {{customer}}", body: "{{summary}}", variables: ["customer", "summary"] },
  "admin:quote_received": { title: "New quote request", body: "{{name}}, {{email}}. The lead is in HighLevel.", variables: ["name", "email"] },
  "customer:approval_request": { title: "Your review: {{stage_label}}", body: "{{project_title}} is waiting on your approval.", variables: ["stage_label", "project_title"] },
  "admin:stage_feedback": { title: "Feedback on {{stage_label}}: {{project_title}}", body: "{{note}}", variables: ["stage_label", "project_title", "note", "customer_email"] },
  "admin:stage_approved": { title: "{{stage_label}} approved: {{project_title}}", body: "{{note}}", variables: ["stage_label", "project_title", "note", "customer_email"] },
  "admin:stage_changes": { title: "{{stage_label}} sent back: {{project_title}}", body: "{{note}}", variables: ["stage_label", "project_title", "note", "customer_email"] },
  "admin:client_provided": { title: "{{stage_label}} {{event}}: {{project_title}}", body: "{{url}}", variables: ["stage_label", "event", "project_title", "url"] },
  "customer:project_note": { title: "A note on {{project_title}}", body: "{{text}}", variables: ["project_title", "text"] },
  "customer:message": { title: "A message about {{project_title}}", body: "{{text}}", variables: ["project_title", "text"] },
  "admin:project_file": { title: "New file on {{project_title}}", body: "{{who}} added {{file_name}}.", variables: ["project_title", "who", "file_name"] },
  "customer:project_file": { title: "We added a file to {{project_title}}", body: "{{file_name}} is in your attachments.", variables: ["project_title", "file_name"] },

  /* editing */
  "admin:edit_requested": { title: "Edit requested: {{title}}", body: "{{summary}}", variables: ["title", "summary", "customer_email"] },
  "customer:edit_added": { title: "We added your request: {{title}}", body: "You asked for this one outside the portal. It is on your plan now, so you can follow it with the rest.", variables: ["title"] },
  "customer:style_guide": { title: "{{headline}}", body: "Open it in Editing, under How we cut for you. Tell us anything you want changed.", variables: ["headline", "version"] },
  "admin:style_guide_note": { title: "Style guide note from {{who}}", body: "{{summary}}", variables: ["who", "summary"] },

  /* invoices, lists */
  "admin:list_invoice_requested": { title: "Invoice asked for: {{list_title}}", body: "{{name}} at {{email}}, {{count}} videos, {{total}} USD.", variables: ["list_title", "name", "email", "count", "total"] },

  /* partners */
  "admin:partner_joined": { title: "New affiliate partner joined", body: "{{name}}, {{channel}}. Auto-approved into Tier 1.", variables: ["name", "channel"] },
  "admin:partner_application": { title: "New partner application", body: "{{name}}, {{channel}}", variables: ["name", "channel"] },
  "partner:partner_invited": { title: "Welcome to the partner program", body: "Your portal is live. Grab your links, assets, and coupon.", variables: ["partner_name"] },

  /* team */
  "customer:team_invited": { title: "You joined {{owner_name}}'s team", body: "{{owner_name}} added you to their {{portal_label}}.", variables: ["owner_name", "portal_label"] },
  "partner:team_invited": { title: "You joined {{owner_name}}'s team", body: "{{owner_name}} added you to their {{portal_label}}.", variables: ["owner_name", "portal_label"] },
  "admin:socialx_request": { title: "SocialX code request", body: "{{name}} ({{email}}) wants their 10% code.{{notes}}", variables: ["name", "email", "notes"] },
  "customer:socialx_request": { title: "Your SocialX code is on the way", body: "We send it to your email personally, usually within a day.", variables: ["name"] },

  /* system */
  "admin:alarm": { title: "{{headline}}", body: "{{message}}", variables: ["headline", "message"] },
};

/* sample values so previews show something real */
export const NOTIFICATION_SAMPLE: Record<string, string> = {
  product_name: "Marketing Video: Unified Inbox",
  amount: "$495",
  order_code: "FEXP-031",
  customer_email: "alex@agency.com",
  customer_name: "Alex",
  customer: "Alex at Agency Co",
  invoice_number: "INV-1042",
  due_line: ", due Sep 12",
  due_date: "Sep 12",
  update_message: "Your first cut is on the way. We will have it to you by Friday.",
  plan_name: "Growth plan",
  new_amount: "$1,200",
  effective_date: "Oct 1",
  video_title: "Unified Inbox walkthrough",
  summary: "Alex at 0:12: can the logo hold a beat longer",
  who: "Alex",
  stage_label: "Animation",
  project_title: "Brand film, 90 seconds",
  note: "Love it. One tweak on the ending.",
  event: "received",
  url: "https://docs.google.com/document/d/example",
  text: "New cut is up, have a look at the ending.",
  file_name: "brand-logo.png",
  title: "Podcast clip, episode 12",
  headline: "Your style guide is ready to read",
  version: "2",
  list_title: "Onboarding series",
  name: "Alex",
  email: "alex@agency.com",
  count: "3",
  total: "1,485",
  channel: "YouTube",
  partner_name: "Alex",
  owner_name: "Jordan",
  portal_label: "customer portal",
  notes: " Notes: for my agency clients.",
  message: "payment_intent.succeeded could not be matched to an order",
};

export const actionsInGroup = (group: CommGroupKey) => COMM_ACTIONS.filter((a) => a.group === group);
