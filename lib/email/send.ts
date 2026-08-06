import "server-only";

/*
 * Transactional email via Brevo's HTTP API (the same Brevo account already used
 * for Supabase auth SMTP; generate an API key under SMTP & API -> API Keys).
 *
 * Fail-soft by design: with no BREVO_API_KEY, or on any send error, it logs and
 * returns false instead of throwing, so a failed email never breaks the action
 * that triggered it (e.g. posting an order update).
 *
 * Env:
 *  - BREVO_API_KEY    Brevo API key (required to actually send)
 *  - EMAIL_FROM       verified sender address (default hi@ghlvideo.com)
 *  - EMAIL_FROM_NAME  sender display name (default "GHL Video")
 */
export type SendEmailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  replyTo?: string;
};

export type SendResult = { ok: boolean; error?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.warn("[email] BREVO_API_KEY not set; skipping send to", input.to);
    return { ok: false, error: "BREVO_API_KEY is not set on the server (check the Vercel env + redeploy)." };
  }
  const from = process.env.EMAIL_FROM ?? "hi@ghlvideo.com";
  const fromName = process.env.EMAIL_FROM_NAME ?? "GHL Video";
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": key,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: from, name: fromName },
        to: [{ email: input.to, name: input.toName || undefined }],
        subject: input.subject,
        htmlContent: input.html,
        replyTo: input.replyTo ? { email: input.replyTo } : { email: from, name: fromName },
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      console.error("[email] Brevo send failed", res.status, detail);
      return { ok: false, error: `Brevo returned ${res.status}. ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] send error", msg);
    return { ok: false, error: msg };
  }
}
