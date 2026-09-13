import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { applyInbound } from "@/lib/highlevel/inbound";
import { applyInboundInvoice, inboundInvoiceId } from "@/lib/highlevel/money";
import { loadHlConfig } from "@/lib/highlevel/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * What HighLevel tells us. A workflow in the sub-account posts here on
 * "Contact Changed" (Automation > Workflows > Webhook action), with the
 * shared secret in the URL: /api/webhooks/highlevel?key=<HIGHLEVEL_WEBHOOK_SECRET>
 * or in an x-ghlv-key header. Every event is kept raw in hl_inbound with
 * how it was handled; only the contact's own details are applied.
 */
function keyMatches(given: string, secret: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.HIGHLEVEL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "HighLevel webhooks are not configured." }, { status: 503 });
  const given = req.headers.get("x-ghlv-key") ?? new URL(req.url).searchParams.get("key") ?? "";
  if (!keyMatches(given, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const db = supabaseAdmin();
  const event =
    (typeof payload.type === "string" && payload.type) ||
    (typeof payload.event === "string" && payload.event) ||
    "contact";
  const { data: row } = await db.from("hl_inbound").insert({ event, payload }).select("id").single();

  /* an invoice event (paid, viewed, void) or a contact event */
  const invoiceId = inboundInvoiceId(payload);
  const location = process.env.HIGHLEVEL_LOCATION_ID ?? null;
  let result: { outcome: string; changed: string[] };
  if (invoiceId && location) {
    const cfg = await loadHlConfig(db, location);
    result = cfg
      ? { outcome: await applyInboundInvoice(db, cfg, invoiceId), changed: ["invoice"] }
      : { outcome: "HighLevel is not provisioned here", changed: [] };
  } else {
    result = await applyInbound(db, payload, location);
  }
  if (row?.id)
    await db
      .from("hl_inbound")
      .update({ processed_at: new Date().toISOString(), outcome: result.outcome })
      .eq("id", row.id);
  return NextResponse.json({ ok: true, outcome: result.outcome, changed: result.changed });
}
