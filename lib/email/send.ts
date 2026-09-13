import "server-only";
import { logEmail } from "./log";
import { emailRoute, sendViaHighLevel } from "@/lib/highlevel/email";

/*
 * Transactional email. Since phase 4 (September 2026) every client-side email
 * leaves through HighLevel's conversations, so it sits on the client's
 * contact over there and a reply lands on the same thread; team alerts still
 * go through Brevo's HTTP API (the same Brevo account used for Supabase auth
 * SMTP). lib/highlevel/email.ts decides the door.
 *
 * Fail-soft by design: with no key, or on any send error, it logs and
 * returns false instead of throwing, so a failed email never breaks the action
 * that triggered it (e.g. posting an order update). A HighLevel failure falls
 * back to Brevo when Brevo can send.
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
  if (emailRoute(input.log?.templateKey, input.to) === "highlevel") {
    const hl = await sendViaHighLevel({
      to: input.to,
      toName: input.toName,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    if (hl.ok) {
      await logEmail({
        to: input.to,
        toName: input.toName,
        subject: input.subject,
        status: "sent",
        source: input.log?.source,
        templateKey: input.log?.templateKey,
        meta: { ...(input.log?.meta ?? {}), provider: "highlevel", hl_message_id: hl.messageId, hl_conversation_id: hl.conversationId },
      });
      return { ok: true };
    }
    console.error("[email] HighLevel send failed, falling back:", hl.error);
    if (!process.env.BREVO_API_KEY) {
      await logEmail({
        to: input.to,
        toName: input.toName,
        subject: input.subject,
        status: "failed",
        error: `HighLevel: ${hl.error}`,
        source: input.log?.source,
        templateKey: input.log?.templateKey,
        meta: { ...(input.log?.meta ?? {}), provider: "highlevel" },
      });
      return { ok: false, error: `HighLevel: ${hl.error}` };
    }
  }
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
