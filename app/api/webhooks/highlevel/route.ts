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
 * shared secret in an x-ghlv-key header. The header is the only place it is
 * read from: a secret in the query string is copied into every access log
 * and proxy on the way (audit, 15 September 2026). Every event is kept raw
 * in hl_inbound with how it was handled; only the contact's own details are
 * applied.
 */
const KEY_HEADER = "x-ghlv-key";
/* a contact event is a few hundred bytes; anything past this is not one */
const MAX_BODY_BYTES = 64 * 1024;

function keyMatches(given: string, secret: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* When HighLevel says the contact last changed, as an ISO string: a
   workflow payload carries date_updated, the API's shape dateUpdated. */
function changedAt(payload: Record<string, unknown>): string | undefined {
  const raw = payload.date_updated ?? payload.dateUpdated;
  if (typeof raw !== "string") return undefined;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export async function POST(req: Request) {
  const secret = process.env.HIGHLEVEL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "HighLevel webhooks are not configured." }, { status: 503 });
  const given = req.headers.get(KEY_HEADER) ?? "";
  if (!keyMatches(given, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  /* the declared size first, then the real one: a caller can omit or
     understate content-length, and neither way gets a large body parsed */
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
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
    /* the payload's own change time goes along, so a delivery that arrives
       late cannot undo an edit made here after it was sent; a payload with
       no time is taken at HighLevel's word, as before */
    result = await applyInbound(db, payload, location, { changedAt: changedAt(payload) });
  }
  if (row?.id)
    await db
      .from("hl_inbound")
      .update({ processed_at: new Date().toISOString(), outcome: result.outcome })
      .eq("id", row.id);
  return NextResponse.json({ ok: true, outcome: result.outcome, changed: result.changed });
}
