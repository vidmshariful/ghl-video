import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAccount } from "@/lib/accounts";
import { quoteOpen, signatureOk } from "@/lib/quotes";
import { noteOnContact } from "@/lib/highlevel/sync";

/*
 * What happens when a client answers a quote, in one place, whether they
 * answered on the public quote page or in their portal.
 *
 * Accepting books the work in: the account exists, the project exists (or
 * is priced) at the agreed amount, the enquiry it came from is won, and
 * HighLevel hears about it as a note on the contact and through the deal
 * card the project sync keeps. Money follows separately: the studio raises
 * the invoice from the project, the way phase 3 built it.
 */

type Row = Record<string, unknown>;
const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export async function acceptQuote(
  db: SupabaseClient,
  quote: Row,
  input: { name: unknown; ip: string | null },
): Promise<{ ok: true; projectId: string } | { ok: false; error: string; status: number }> {
  if (!quoteOpen(quote)) return { ok: false, error: "This quote is no longer open.", status: 409 };
  if (!signatureOk(input.name)) return { ok: false, error: "Type your name to accept.", status: 400 };
  const name = input.name.trim();
  const email = String(quote.customer_email).toLowerCase();

  /* the account, so the project has somewhere to live and the portal opens */
  const account = await ensureAccount(db, {
    email,
    name: (quote.customer_name as string | null) || null,
    company: (quote.customer_company as string | null) || null,
    source: "enquiry",
  });

  let projectId = (quote.project_id as string | null) ?? null;
  if (projectId) {
    await db
      .from("projects")
      .update({ agreed_cents: Number(quote.total_cents), quoted_cents: Number(quote.total_cents), updated_at: new Date().toISOString() })
      .eq("id", projectId);
  } else {
    const { data: made, error } = await db
      .from("projects")
      .insert({
        customer_id: account?.id ?? null,
        customer_email: email,
        title: String(quote.title),
        brief: (quote.scope as string | null) || null,
        status: "backlog",
        quoted_cents: Number(quote.total_cents),
        agreed_cents: Number(quote.total_cents),
        source: "quote",
      })
      .select("id")
      .single();
    if (error || !made) return { ok: false, error: "The quote was accepted but the project could not be opened. We have been told.", status: 500 };
    projectId = String(made.id);
  }

  await db
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: name,
      accepted_ip: input.ip,
      project_id: projectId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(quote.id));

  if (quote.request_id) {
    await db
      .from("project_requests")
      .update({ status: "won", project_id: projectId, updated_at: new Date().toISOString() })
      .eq("id", String(quote.request_id));
  }

  await noteOnContact(
    db,
    email,
    `Quote ${String(quote.number)} accepted on ghlvideo.com by ${name}: ${String(quote.title)}, ${money(Number(quote.total_cents))}.`,
  );
  try {
    const { sendQuoteAcceptedAlert } = await import("@/lib/email/notify");
    await sendQuoteAcceptedAlert(db, {
      number: String(quote.number),
      title: String(quote.title),
      total_cents: Number(quote.total_cents),
      customer_email: email,
      customer_name: (quote.customer_name as string | null) ?? null,
      project_id: projectId,
      customer_id: account?.id ?? null,
    });
  } catch (e) {
    console.error(`[quote] team alert failed: ${e instanceof Error ? e.message : e}`);
  }
  return { ok: true, projectId };
}

export async function declineQuote(
  db: SupabaseClient,
  quote: Row,
  reason: unknown,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!quoteOpen(quote)) return { ok: false, error: "This quote is no longer open.", status: 409 };
  const why = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";
  await db
    .from("quotes")
    .update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: why || null, updated_at: new Date().toISOString() })
    .eq("id", String(quote.id));
  if (quote.request_id) {
    await db
      .from("project_requests")
      .update({ status: "lost", lost_reason: why ? `Declined the quote: ${why}` : "Declined the quote", updated_at: new Date().toISOString() })
      .eq("id", String(quote.request_id));
  }
  await noteOnContact(
    db,
    String(quote.customer_email).toLowerCase(),
    `Quote ${String(quote.number)} declined on ghlvideo.com${why ? `: ${why}` : ""}.`,
  );
  return { ok: true };
}

/** The quote as a client or a public page sees it: no internal ids beyond its own. */
export function publicQuote(q: Row) {
  return {
    id: String(q.id),
    number: String(q.number),
    title: String(q.title),
    customerName: (q.customer_name as string | null) ?? null,
    customerCompany: (q.customer_company as string | null) ?? null,
    customerEmail: String(q.customer_email),
    lineItems: (Array.isArray(q.line_items) ? (q.line_items as Row[]) : []).map((l) => ({
      description: String(l.description ?? ""),
      amountCents: Number(l.amount_cents ?? 0),
      quantity: Number(l.quantity ?? 1),
      unitCents: Number(l.unit_cents ?? l.amount_cents ?? 0),
    })),
    subtotalCents: Number(q.subtotal_cents ?? q.total_cents),
    discountKind: (q.discount_kind as "percent" | "flat" | null) ?? null,
    discountValue: q.discount_value == null ? null : Number(q.discount_value),
    totalCents: Number(q.total_cents),
    scope: (q.scope as string | null) ?? null,
    validUntil: (q.valid_until as string | null) ?? null,
    status: String(q.status),
    open: quoteOpen(q),
    sentAt: (q.sent_at as string | null) ?? null,
    acceptedAt: (q.accepted_at as string | null) ?? null,
    acceptedBy: (q.accepted_by as string | null) ?? null,
    declinedAt: (q.declined_at as string | null) ?? null,
    createdAt: String(q.created_at),
  };
}
