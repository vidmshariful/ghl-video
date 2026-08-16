import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { createDeliverablesForOrder, listDeliverables } from "@/lib/deliverables";

export const runtime = "nodejs";

const STATUSES = ["queued", "in_production", "ready", "revisions", "approved"] as const;
type Status = (typeof STATUSES)[number];

/*
 * The studio's control room for one order: read its videos, and update one of
 * them (status, the HighLevel link, a note).
 *
 * Only these three fields are writable. Which videos an order owes is decided
 * by what was bought, never by hand, so title, position and catalog code are
 * not editable here. GET will build a missing list on the spot, which covers
 * an order settled before deliverables existed without anyone running a script.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  let rows = await listDeliverables(db, id);
  if (!rows.length) {
    await createDeliverablesForOrder(db, id).catch(() => null);
    rows = await listDeliverables(db, id);
  }
  return NextResponse.json({ deliverables: rows });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const deliverableId = typeof body.deliverableId === "string" ? body.deliverableId : "";
  if (!deliverableId) {
    return NextResponse.json({ error: "Which video?" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Scope the row to this order before writing, so a stray id from one order
  // can never edit another order's video.
  const { data: current } = await db
    .from("order_deliverables")
    .select("id, status, revision_round, video_url")
    .eq("id", deliverableId)
    .eq("order_id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as Status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const next = body.status as Status;
    patch.status = next;
    // Stamp the moments worth knowing later, and count a revision round on the
    // way in rather than on the way out, so "how many rounds did this take"
    // stays honest even if it is later approved.
    if (next === "ready" && current.status !== "ready") patch.ready_at = new Date().toISOString();
    if (next === "approved") patch.approved_at = new Date().toISOString();
    if (next === "revisions" && current.status !== "revisions") {
      patch.revision_round = (current.revision_round as number) + 1;
    }
  }

  if (typeof body.videoUrl === "string") {
    const url = body.videoUrl.trim();
    if (!url) {
      patch.video_url = null;
    } else if (/^https?:\/\//i.test(url)) {
      patch.video_url = url;
    } else {
      return NextResponse.json(
        { error: "The video link must start with http:// or https://" },
        { status: 400 },
      );
    }
  }

  if (typeof body.note === "string") patch.note = body.note.trim() || null;

  const { error } = await db.from("order_deliverables").update(patch).eq("id", deliverableId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("order_events").insert({
    order_id: id,
    event_type: "deliverable_updated",
    payload: { deliverable_id: deliverableId, by: admin.email, ...patch },
  });

  const rows = await listDeliverables(db, id);
  return NextResponse.json({ deliverables: rows });
}
