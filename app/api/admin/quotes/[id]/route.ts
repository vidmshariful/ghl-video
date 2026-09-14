import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseQuoteInput } from "@/lib/quotes";
import { publicQuote } from "@/lib/quote-flow";
import { noteOnContact } from "@/lib/highlevel/sync";

export const runtime = "nodejs";

/*
 * Quote actions. "send" emails it (through HighLevel, like every client
 * email) and opens it for acceptance; "edit" rewrites a draft or an open
 * one, and the client's link keeps working; "void" withdraws it. An
 * answered quote is a record and cannot be changed.
 */
const UUID_RE = /^[0-9a-f-]{36}$/i;
type Row = Record<string, unknown>;
const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  const { data: q } = await db.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!q) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const answered = q.status === "accepted" || q.status === "declined";

  if (body.action === "send") {
    if (answered || q.status === "void") return NextResponse.json({ error: "This quote has been answered or withdrawn." }, { status: 400 });
    if (q.status === "sent") return NextResponse.json({ error: "Already sent." }, { status: 400 });
    if (q.request_id)
      await db.from("project_requests").update({ status: "quoted", updated_at: new Date().toISOString() }).eq("id", String(q.request_id));
    const { data: sent } = await db
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    try {
      const { sendQuoteEmail } = await import("@/lib/email/notify");
      await sendQuoteEmail(db, {
        number: String(q.number),
        token: String(q.token),
        title: String(q.title),
        total_cents: Number(q.total_cents),
        valid_until: (q.valid_until as string | null) ?? null,
        customer_email: String(q.customer_email),
        customer_name: (q.customer_name as string | null) ?? null,
      });
    } catch (e) {
      console.error(`[quote] send email failed: ${e instanceof Error ? e.message : e}`);
    }
    await noteOnContact(
      db,
      String(q.customer_email),
      `Quote ${String(q.number)} sent from ghlvideo.com: ${String(q.title)}, ${money(Number(q.total_cents))}.`,
    );
    return NextResponse.json({ ok: true, quote: publicQuote((sent ?? q) as Row) });
  }

  if (body.action === "void") {
    if (answered) return NextResponse.json({ error: "An answered quote cannot be withdrawn." }, { status: 400 });
    await db.from("quotes").update({ status: "void", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "edit") {
    if (answered || q.status === "void") return NextResponse.json({ error: "This quote has been answered or withdrawn." }, { status: 400 });
    const parsed = parseQuoteInput({ ...body, customerEmail: body.customerEmail ?? q.customer_email });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const n = parsed.quote;
    const { data: updated, error } = await db
      .from("quotes")
      .update({
        customer_name: n.customerName || null,
        customer_company: n.customerCompany || null,
        title: n.title,
        line_items: n.lineItems,
        subtotal_cents: n.subtotalCents,
        discount_kind: n.discountKind,
        discount_value: n.discountValue,
        total_cents: n.totalCents,
        scope: n.scope || null,
        valid_until: n.validUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, quote: publicQuote(updated as Row) });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
