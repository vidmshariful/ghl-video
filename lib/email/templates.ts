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
};

/* Wrap message content in the shared GHL Video branded frame. */
export function wrapEmail(content: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08090d;margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;">
      <tr><td style="height:4px;background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="background-color:#12141b;border:1px solid #242736;border-top:0;border-radius:0 0 12px 12px;padding:34px 36px 30px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <img src="${EMAIL_LOGO}" width="150" alt="GHL Video" style="display:block;width:150px;max-width:150px;height:auto;border:0;margin:0 0 22px;">
        ${content}
      </td></tr>
      <tr><td style="padding:18px 36px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6076;">GHL Video, a brand of Vidiosa LLC. Questions? <a href="mailto:hi@ghlvideo.com" style="color:#9096a8;">hi@ghlvideo.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
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
