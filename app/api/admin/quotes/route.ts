import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseQuoteInput } from "@/lib/quotes";
import { publicQuote } from "@/lib/quote-flow";

export const runtime = "nodejs";

/*
 * Quotes, from the studio's side. POST raises one for a lead, a client or
 * a project, as a draft; PATCH on /[id] sends it. GET lists them all with
 * the ids that tie them to enquiries and projects, so the Custom screen can
 * show each one next to what it is for.
 */
type Row = Record<string, unknown>;

function shape(q: Row) {
  return {
    ...publicQuote(q),
    token: String(q.token),
    requestId: (q.request_id as string | null) ?? null,
    projectId: (q.project_id as string | null) ?? null,
    createdBy: (q.created_by as string | null) ?? null,
  };
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = supabaseAdmin();
  const { data } = await db.from("quotes").select("*").order("created_at", { ascending: false }).limit(500);
  return NextResponse.json({ quotes: ((data ?? []) as Row[]).map(shape) });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseQuoteInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const q = parsed.quote;
  const db = supabaseAdmin();

  /* a quote for a project takes the project's client; the form cannot disagree with the row */
  if (q.projectId) {
    const { data: p } = await db.from("projects").select("customer_email").eq("id", q.projectId).maybeSingle();
    if (!p) return NextResponse.json({ error: "That project does not exist." }, { status: 404 });
    if (String(p.customer_email).toLowerCase() !== q.customerEmail)
      return NextResponse.json({ error: "The quote's email is not the project's client." }, { status: 400 });
  }

  const { data: made, error } = await db
    .from("quotes")
    .insert({
      customer_email: q.customerEmail,
      customer_name: q.customerName || null,
      customer_company: q.customerCompany || null,
      request_id: q.requestId,
      project_id: q.projectId,
      title: q.title,
      line_items: q.lineItems,
      subtotal_cents: q.subtotalCents,
      discount_kind: q.discountKind,
      discount_value: q.discountValue,
      total_cents: q.totalCents,
      scope: q.scope || null,
      valid_until: q.validUntil,
      status: "draft",
      created_by: admin.email,
    })
    .select("*")
    .single();
  if (error || !made) return NextResponse.json({ error: error?.message ?? "Could not raise the quote." }, { status: 500 });
  return NextResponse.json({ quote: shape(made as Row) });
}
