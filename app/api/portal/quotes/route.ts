import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { acceptQuote, declineQuote, publicQuote } from "@/lib/quote-flow";

export const runtime = "nodejs";

/*
 * The client's quotes in their portal: the open ones first, so a quote
 * waiting on them is the first thing they see, and everything answered
 * underneath. Accepting here is the same act as on the public page; only
 * the account owner may do it, a teammate can read.
 */
type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "projects")) return NextResponse.json({ quotes: [], canAnswer: false });
  const { data } = await db
    .from("quotes")
    .select("*")
    .ilike("customer_email", ctx.ownerEmail)
    .neq("status", "draft")
    .neq("status", "void")
    .order("created_at", { ascending: false });
  const quotes = ((data ?? []) as Row[]).map(publicQuote).sort((a, b) => Number(b.open) - Number(a.open));
  return NextResponse.json({ quotes, canAnswer: ctx.selfEmail.toLowerCase() === ctx.ownerEmail.toLowerCase() });
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (ctx.selfEmail.toLowerCase() !== ctx.ownerEmail.toLowerCase())
    return NextResponse.json({ error: "Only the account owner can answer a quote." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const { data: q } = await db.from("quotes").select("*").eq("id", id).ilike("customer_email", ctx.ownerEmail).maybeSingle();
  if (!q) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (body.action === "accept") {
    const r = await acceptQuote(db, q as Row, { name: body.name, ip });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, projectId: r.projectId });
  }
  if (body.action === "decline") {
    const r = await declineQuote(db, q as Row, body.reason);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
