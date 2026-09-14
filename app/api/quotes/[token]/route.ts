import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { acceptQuote, declineQuote, publicQuote } from "@/lib/quote-flow";

export const runtime = "nodejs";

/*
 * The public quote, by its unguessable token: read it, accept it with a
 * typed name, or decline it. No login, because a lead has none yet; the
 * token is the capability, the same rule as the invoice page.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(token: string) {
  if (!UUID_RE.test(token)) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("quotes").select("*").eq("token", token).maybeSingle();
  return data ? { db, quote: data as Record<string, unknown> } : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hit = await load(token);
  if (!hit) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ quote: publicQuote(hit.quote) });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = rateLimit(`quote:${ip ?? token}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many tries. Give it a minute." }, { status: 429 });
  const hit = await load(token);
  if (!hit) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "accept") {
    const r = await acceptQuote(hit.db, hit.quote, { name: body.name, ip });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, projectId: r.projectId });
  }
  if (body.action === "decline") {
    const r = await declineQuote(hit.db, hit.quote, body.reason);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
