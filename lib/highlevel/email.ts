/*
 * Client email through HighLevel (phase 4). An email sent here lands in the
 * client's conversation in the sub-account, goes out from HighLevel's
 * sender, and a reply comes back to the same thread. The template, the
 * wording and the log stay ours; only the door changes.
 *
 * No "server-only" marker: the cron script checks delivery through this
 * module too. Nothing here throws to a caller: the send path is fail-soft
 * by design (lib/email/send.ts), and this returns what happened.
 */
import { hlFetch, locationId } from "./client";
import { emailAudience } from "@/lib/comms";
import { syncAllowed } from "./sync";

export type HlEmailResult =
  | { ok: true; messageId: string; conversationId: string | null }
  | { ok: false; error: string };

/** The audiences whose email belongs on a CRM contact. */
const CLIENT_SIDE = new Set(["client", "lead", "partner"]);

/**
 * Which door an email leaves through.
 *
 *   highlevel  a client-side template, HighLevel configured, the address
 *              allowed here, and the switch not off
 *   brevo      everything else that Brevo can still send (team alerts)
 *
 * HIGHLEVEL_EMAIL is "on" or "off". Unset: on in production, off on staging,
 * so a copy of production is never mailed from the sandbox by accident.
 */
export function emailRoute(templateKey: string | null | undefined, to: string): "highlevel" | "brevo" {
  if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) return "brevo";
  const flag = process.env.HIGHLEVEL_EMAIL;
  const on = flag === "on" || (flag !== "off" && process.env.GHLV_ENV !== "staging");
  if (!on) return "brevo";
  const audience = templateKey ? emailAudience(templateKey) : null;
  if (!audience || !CLIENT_SIDE.has(audience)) return "brevo";
  if (!syncAllowed(to.toLowerCase())) return "brevo";
  return "highlevel";
}

function splitName(name: string | null | undefined): { firstName?: string; lastName?: string } {
  if (!name || !name.trim()) return {};
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? { firstName: parts[0] } : { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Send one email from HighLevel to a contact, making the contact if it is new. */
export async function sendViaHighLevel(input: {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<HlEmailResult> {
  try {
    const email = input.to.trim().toLowerCase();
    const body: Record<string, unknown> = { locationId: locationId(), email, ...splitName(input.toName) };
    const up = await hlFetch("/contacts/upsert", { method: "POST", body: JSON.stringify(body) });
    const contact = (up.contact as Record<string, unknown>) ?? up;
    const contactId = String(contact.id ?? "");
    if (!contactId) return { ok: false, error: "HighLevel returned no contact for the address" };

    const from = process.env.HIGHLEVEL_EMAIL_FROM?.trim();
    const sent = await hlFetch("/conversations/messages", {
      method: "POST",
      body: JSON.stringify({
        type: "Email",
        contactId,
        subject: input.subject,
        html: input.html,
        ...(from ? { emailFrom: from } : {}),
        ...(input.replyTo ? { emailReplyTo: input.replyTo } : {}),
      }),
    });
    const messageId = String(sent.emailMessageId ?? sent.messageId ?? "");
    if (!messageId) return { ok: false, error: `HighLevel queued nothing: ${JSON.stringify(sent).slice(0, 200)}` };
    return { ok: true, messageId, conversationId: sent.conversationId ? String(sent.conversationId) : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** What HighLevel says became of an email it queued. */
export async function emailStatus(messageId: string): Promise<{ status: string; error: string | null } | null> {
  try {
    const j = await hlFetch(`/conversations/messages/email/${messageId}`, { method: "GET" });
    const m = (j.emailMessage as Record<string, unknown>) ?? j;
    return { status: String(m.status ?? ""), error: typeof m.error === "string" && m.error ? m.error : null };
  } catch {
    return null;
  }
}
