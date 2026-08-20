import "server-only";
import { logEmail } from "./log";

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
  /* where this email came from, for the log: a template key and a door.
     Optional so no caller breaks; callers that matter pass it. */
  log?: { source?: string; templateKey?: string | null; meta?: Record<string, unknown> };
};

export type SendResult = { ok: boolean; error?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.warn("[email] BREVO_API_KEY not set; skipping send to", input.to);
    /* the row that finally makes this failure mode visible: for weeks the
       only witness was this console line */
    await logEmail({
      to: input.to,
      toName: input.toName,
      subject: input.subject,
      status: "skipped",
      error: "BREVO_API_KEY is not set on the server",
      source: input.log?.source,
      templateKey: input.log?.templateKey,
      meta: input.log?.meta,
    });
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
      await logEmail({
        to: input.to,
        toName: input.toName,
        subject: input.subject,
        status: "failed",
        error: `Brevo returned ${res.status}. ${detail}`,
        source: input.log?.source,
        templateKey: input.log?.templateKey,
        meta: input.log?.meta,
      });
      return { ok: false, error: `Brevo returned ${res.status}. ${detail}` };
    }
    await logEmail({
      to: input.to,
      toName: input.toName,
      subject: input.subject,
      status: "sent",
      source: input.log?.source,
      templateKey: input.log?.templateKey,
      meta: input.log?.meta,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] send error", msg);
    await logEmail({
      to: input.to,
      toName: input.toName,
      subject: input.subject,
      status: "failed",
      error: msg,
      source: input.log?.source,
      templateKey: input.log?.templateKey,
      meta: input.log?.meta,
    });
    return { ok: false, error: msg };
  }
}
