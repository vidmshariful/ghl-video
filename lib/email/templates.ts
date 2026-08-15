/*
 * Transactional email templates: the shared branded shell, the code-side
 * content defaults (source of truth for the seed + admin "reset to default"),
 * the variable list, and a simple {{var}} renderer. Client-safe (no server-only
 * imports), so the admin screen can pull the defaults, wrap a preview, and show
 * the variable reference.
 *
 * The BRANDED FRAME (gold bar, logo, dark card, footer) is applied by
 * wrapEmail() at every render point (send, preview, test), so every email is
 * consistently branded and template bodies are just the inner message content.
 */

export const SITE_URL = "https://www.ghlvideo.com";
export const EMAIL_LOGO =
  "https://storage.googleapis.com/msgsndr/s3JXyf9P6cTSxG7NfF1B/media/65bfe9c70e904b34d226f243.png";

export type EmailTemplate = {
  key: string;
  name: string;
  description: string;
  subject: string;
  body: string;
};

/* variables each template can use, shown as a reference in the admin editor */
export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  order_update: [
    "customer_name",
    "product_name",
    "order_code",
    "update_message",
    "stage",
    "portal_url",
    "delivery_url",
  ],
  order_confirmation: [
    "customer_name",
    "product_name",
    "order_code",
    "amount",
    "intake_url",
    "portal_url",
  ],
  order_delivered: ["customer_name", "product_name", "order_code", "delivery_url", "portal_url"],
  order_refunded: ["customer_name", "product_name", "order_code", "amount", "portal_url"],
  subscription_started: ["customer_name", "plan_name", "amount", "portal_url"],
  subscription_canceled: ["customer_name", "plan_name", "portal_url"],
  quote_received: ["name", "contact_url"],
  partner_application_received: ["name", "partners_url"],
  partner_invite: ["partner_name", "partner_email", "partners_url"],
  team_invite: ["member_name", "member_email", "owner_name", "portal_label", "portal_url"],
  admin_new_order: ["customer_name", "customer_email", "product_name", "order_code", "amount", "admin_url"],
  admin_new_application: ["name", "email", "channel", "audience", "admin_url"],
  admin_dispute: ["customer_email", "product_name", "order_code", "amount", "reason", "admin_url"],
};

/* shared inline-style shorthands for the default bodies below */
const H = `margin:0 0 14px;font-size:22px;line-height:1.25;color:#eef0f6;font-weight:bold;`;
const P = `margin:0 0 20px;font-size:15px;line-height:1.6;color:#9096a8;`;
const STRONG = `color:#eef0f6;`;
const SMALL = `margin:0 0 26px;font-size:13px;line-height:1.5;color:#5a6076;`;
const BOX = `border-left:3px solid #fcc000;background-color:#0d0f16;padding:14px 18px;border-radius:4px;font-size:15px;line-height:1.6;color:#eef0f6;`;
const BTN_TD = `background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px;`;
const BTN_A = `display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#08090d;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;`;
const btn = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="${BTN_TD}"><a href="${href}" style="${BTN_A}">${label} &rarr;</a></td></tr></table>`;

/*
 * Wrap message content in the shared GHL Video branded frame, as a COMPLETE
 * HTML document. The full doctype/head/body matters: the color-scheme meta tells
 * Gmail/Apple Mail this email is dark-by-design (so they do not force-invert it
 * into a broken light hybrid), and the dark <body> background stops clients from
 * painting their own white behind it. bgcolor attributes back up the CSS for
 * older/Outlook renderers.
 */
export function wrapEmail(content: string): string {
  return `<!doctype html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>GHL Video</title>
</head>
<body style="margin:0;padding:0;background-color:#08090d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#08090d" style="background-color:#08090d;margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;">
      <tr><td style="height:4px;background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td bgcolor="#12141b" style="background-color:#12141b;border:1px solid #242736;border-top:0;border-radius:0 0 12px 12px;padding:34px 36px 30px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <img src="${EMAIL_LOGO}" width="150" alt="GHL Video" style="display:block;width:150px;max-width:150px;height:auto;border:0;margin:0 0 22px;">
        ${content}
      </td></tr>
      <tr><td style="padding:18px 36px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6076;">GHL Video, a brand of Vidiosa LLC. Questions? <a href="mailto:hi@ghlvideo.com" style="color:#9096a8;">hi@ghlvideo.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const ORDER_UPDATE_BODY = `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#eef0f6;font-weight:bold;">Update on your order</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#9096a8;">Hi {{customer_name}}, there is an update on your order <strong style="color:#eef0f6;">{{product_name}}</strong> ({{order_code}}):</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="border-left:3px solid #fcc000;background-color:#0d0f16;padding:14px 18px;border-radius:4px;font-size:15px;line-height:1.6;color:#eef0f6;">{{update_message}}</td></tr></table>
<p style="margin:0 0 26px;font-size:13px;line-height:1.5;color:#5a6076;">Current status: <strong style="color:#9096a8;">{{stage}}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px;"><a href="{{portal_url}}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#08090d;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;">View your order &rarr;</a></td></tr></table>`;

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    key: "order_update",
    name: "Order update",
    description: "Sent to the client when the team posts an update on their order.",
    subject: "Update on your order {{order_code}}",
    body: ORDER_UPDATE_BODY,
  },
  {
    key: "order_confirmation",
    name: "Order confirmation",
    description: "Sent to the client the moment their payment settles.",
    subject: "Order confirmed: {{product_name}}",
    body: `<h1 style="${H}">Your order is confirmed.</h1>
<p style="${P}">Hi {{customer_name}}, thank you. We received your payment of <strong style="${STRONG}">{{amount}}</strong> for <strong style="${STRONG}">{{product_name}}</strong> ({{order_code}}) and production is queued.</p>
<p style="${P}">One step before we start: send your branding through the short intake, so every frame comes back yours.</p>
${btn("{{intake_url}}", "Complete your intake")}
<p style="${SMALL}margin-top:22px;">Track everything any time in <a href="{{portal_url}}" style="color:#9096a8;">your portal</a>. This email is your receipt.</p>`,
  },
  {
    key: "order_delivered",
    name: "Order delivered",
    description: "Sent when the team moves an order to Delivered, with the delivery link.",
    subject: "Your video is ready: {{product_name}}",
    body: `<h1 style="${H}">Delivered.</h1>
<p style="${P}">Hi {{customer_name}}, your <strong style="${STRONG}">{{product_name}}</strong> ({{order_code}}) is ready.</p>
${btn("{{delivery_url}}", "Get your video")}
<p style="${SMALL}margin-top:22px;">The link also lives in <a href="{{portal_url}}" style="color:#9096a8;">your portal</a>. Want tweaks? Reply to this email and we will jump on it.</p>`,
  },
  {
    key: "order_refunded",
    name: "Order refunded",
    description: "Sent to the client when their order is refunded.",
    subject: "Your refund for {{order_code}} is on its way",
    body: `<h1 style="${H}">Refund issued.</h1>
<p style="${P}">Hi {{customer_name}}, we refunded <strong style="${STRONG}">{{amount}}</strong> for <strong style="${STRONG}">{{product_name}}</strong> ({{order_code}}). Depending on your bank it lands within 5 to 10 business days.</p>
<p style="${P}">Sorry it did not work out this time. If there is anything we could have done better, reply and tell us straight.</p>`,
  },
  {
    key: "subscription_started",
    name: "Editing plan started",
    description: "Sent when an editing subscription activates.",
    subject: "Your editing plan is live",
    body: `<h1 style="${H}">Welcome aboard.</h1>
<p style="${P}">Hi {{customer_name}}, your <strong style="${STRONG}">{{plan_name}}</strong> plan is active at <strong style="${STRONG}">{{amount}}</strong> per month.</p>
<p style="${P}">Next step: send your footage and brand notes, and we will set up your editing workflow. Watch for a note from your producer.</p>
${btn("{{portal_url}}", "Open your portal")}
<p style="${SMALL}margin-top:22px;">Manage or cancel your plan any time from the portal. No contracts.</p>`,
  },
  {
    key: "subscription_canceled",
    name: "Editing plan canceled",
    description: "Sent when an editing subscription ends.",
    subject: "Your editing plan has ended",
    body: `<h1 style="${H}">Plan canceled.</h1>
<p style="${P}">Hi {{customer_name}}, your <strong style="${STRONG}">{{plan_name}}</strong> plan is now canceled and you will not be billed again.</p>
<p style="${P}">Thanks for editing with us. When you are ready to come back, your portal and history are right where you left them.</p>
${btn("{{portal_url}}", "Open your portal")}`,
  },
  {
    key: "quote_received",
    name: "Quote request received",
    description: "Confirmation to a lead right after they send the quote form.",
    subject: "We got your request",
    body: `<h1 style="${H}">Request received.</h1>
<p style="${P}">Hi {{name}}, thanks for the details. A producer is reading your brief now, and you will hear from us within one business day with a scope and a price.</p>
<p style="${P}">Want to move faster? Grab a call and we will scope it live.</p>
${btn("{{contact_url}}", "Book a call")}`,
  },
  {
    key: "partner_application_received",
    name: "Partner application received",
    description: "Confirmation to someone who applied to the partner program.",
    subject: "Your partner application is in",
    body: `<h1 style="${H}">Application received.</h1>
<p style="${P}">Hi {{name}}, thanks for applying to the GHL Video partner program. We review every application by hand and reply by email, usually within a couple of days.</p>
<p style="${P}">If it is a fit, you get your own partner page, tracked links, promo assets, and a standing discount for your audience.</p>`,
  },
  {
    key: "partner_invite",
    name: "Partner invite",
    description: "Sent when the team invites a partner to the portal.",
    subject: "Your GHL Video partner portal is ready",
    body: `<h1 style="${H}">You are in.</h1>
<p style="${P}">Hi {{partner_name}}, your partner account is ready. Your links, promo assets, live stats, and earnings all live in your portal.</p>
${btn("{{partners_url}}", "Open your portal")}
<p style="${SMALL}margin-top:22px;">First time signing in? Use <strong style="color:#9096a8;">{{partner_email}}</strong> and pick "Set it by email" on the sign-in page to create your password.</p>`,
  },
  {
    key: "team_invite",
    name: "Portal team invite",
    description:
      "Sent when a customer or partner adds a team member to their portal.",
    subject: "{{owner_name}} added you to their GHL Video {{portal_label}}",
    body: `<h1 style="${H}">You have been added to a team.</h1>
<p style="${P}"><strong style="${STRONG}">{{owner_name}}</strong> added you, {{member_name}}, to their GHL Video {{portal_label}}, so you can work in it with them.</p>
${btn("{{portal_url}}", "Open the portal")}
<p style="${SMALL}margin-top:22px;">First time signing in? Use <strong style="color:#9096a8;">{{member_email}}</strong> and pick "Set it by email" on the sign-in page to create your password.</p>`,
  },
  {
    key: "admin_new_order",
    name: "Team alert: new order",
    description: "Internal alert to the team when an order is paid.",
    subject: "New order: {{product_name}} {{amount}}",
    body: `<h1 style="${H}">New paid order.</h1>
<p style="${P}"><strong style="${STRONG}">{{customer_name}}</strong> ({{customer_email}}) bought <strong style="${STRONG}">{{product_name}}</strong> ({{order_code}}) for <strong style="${STRONG}">{{amount}}</strong>.</p>
${btn("{{admin_url}}", "Open Orders")}`,
  },
  {
    key: "admin_new_application",
    name: "Team alert: partner application",
    description: "Internal alert to the team when someone applies to the partner program.",
    subject: "New partner application: {{name}}",
    body: `<h1 style="${H}">New partner application.</h1>
<p style="${P}"><strong style="${STRONG}">{{name}}</strong> ({{email}}) applied. Channel: <strong style="${STRONG}">{{channel}}</strong>. Audience: <strong style="${STRONG}">{{audience}}</strong>.</p>
${btn("{{admin_url}}", "Review in admin")}`,
  },
  {
    key: "admin_dispute",
    name: "Team alert: payment dispute",
    description: "Internal alert when a chargeback or dispute opens. Time-sensitive.",
    subject: "DISPUTE opened: {{order_code}} {{amount}}",
    body: `<h1 style="${H}">A payment dispute was opened.</h1>
<p style="${P}">Order <strong style="${STRONG}">{{order_code}}</strong> ({{product_name}}, {{amount}}) from <strong style="${STRONG}">{{customer_email}}</strong> is disputed. Reason: <strong style="${STRONG}">{{reason}}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="${BOX}">Respond in the Stripe dashboard before the deadline. Evidence wins disputes: delivery links, intake records, and email threads.</td></tr></table>
${btn("{{admin_url}}", "Open Orders")}`,
  },
];

/* fill {{variables}} in a subject or body. Unknown/empty vars render as "". */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => vars[k.toLowerCase()] ?? "");
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
