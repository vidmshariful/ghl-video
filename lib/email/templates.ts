/*
 * Transactional email templates: the code-side defaults (source of truth for
 * the seed + the admin "reset to default"), the variable list shown in the
 * admin, and a simple {{var}} renderer. Client-safe (no server-only imports),
 * so the admin screen can pull the defaults + variable reference.
 */

export const SITE_URL = "https://www.ghlvideo.com";

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

const ORDER_UPDATE_BODY = `<div style="background:#f4f5f7;padding:32px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e8ec;">
      <tr><td style="background:#08090D;padding:22px 32px;">
        <span style="font-size:18px;font-weight:700;color:#FCC000;letter-spacing:-0.01em;">GHL Video</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;color:#111319;">Hi {{customer_name}},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3f4b;">There is an update on your order <strong>{{product_name}}</strong> ({{order_code}}):</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="border-left:3px solid #FCC000;background:#faf7ec;padding:14px 18px;border-radius:4px;font-size:15px;line-height:1.6;color:#1a1c22;">{{update_message}}</td></tr></table>
        <p style="margin:0 0 24px;font-size:14px;color:#5a6076;">Current status: <strong style="color:#111319;">{{stage}}</strong></p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#FCC000;"><a href="{{portal_url}}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#08090D;text-decoration:none;">View your order</a></td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #eef0f3;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9096a8;">A brand of Vidiosa LLC. Questions? Reply to this email or contact <a href="mailto:hi@ghlvideo.com" style="color:#5a6076;">hi@ghlvideo.com</a>.</p>
      </td></tr>
    </table>
  </td></tr></table>
</div>`;

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
