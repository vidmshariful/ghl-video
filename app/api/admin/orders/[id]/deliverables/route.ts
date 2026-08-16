import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { createDeliverablesForOrder, listDeliverables } from "@/lib/deliverables";
import { deriveStage } from "@/lib/order-stage";

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

  /* A new link is a new cut, not a correction. Record it so the old one stays
   * watchable and the client's notes keep pointing at the cut they were about.
   * Re-saving the same link records nothing. */
  if (typeof patch.video_url === "string" && patch.video_url) {
    const { addVersion } = await import("@/lib/versions");
    const v = await addVersion(
      db,
      deliverableId,
      patch.video_url as string,
      admin.email,
      typeof body.versionNote === "string" ? body.versionNote : null,
    );
    if (v) {
      await db.from("order_events").insert({
        order_id: id,
        event_type: "video_version_added",
        payload: { deliverable_id: deliverableId, version: v.version, by: admin.email },
      });
    }
  }

  await db.from("order_events").insert({
    order_id: id,
    event_type: "deliverable_updated",
    payload: { deliverable_id: deliverableId, by: admin.email, ...patch },
  });

  /* Ready is the moment the link is released to the client, so it is the
   * moment worth emailing them about. Only on the way IN, so re-saving a
   * ready video does not mail them twice. */
  if (patch.status === "ready" && current.status !== "ready") {
    const { sendVideoReadyEmail } = await import("@/lib/email/notify");
    await sendVideoReadyEmail(db, deliverableId);
  }

  const rows = await listDeliverables(db, id);

  /* The order's stage is a summary of its videos, so recalculate it here
   * rather than making somebody set it a second time. Delivered is never
   * derived: that move emails the client and stays a button. */
  let stage: string | null = null;
  if (patch.status) {
    const { data: order } = await db
      .from("orders")
      .select("fulfillment_stage, intake_completed")
      .eq("id", id)
      .maybeSingle();
    if (order) {
      const next = deriveStage({
        current: order.fulfillment_stage as string,
        intakeCompleted: Boolean(order.intake_completed),
        statuses: rows.map((r) => r.status),
      });
      if (next && next !== order.fulfillment_stage) {
        await db
          .from("orders")
          .update({
            fulfillment_stage: next,
            stage_changed_at: new Date().toISOString(),
            stage_is_derived: true,
            stage_set_by: null,
          })
          .eq("id", id)
          // never overwrite a delivered order from here
          .neq("fulfillment_stage", "delivered");
        await db.from("order_events").insert({
          order_id: id,
          event_type: "stage_derived",
          payload: { from: order.fulfillment_stage, to: next },
        });
        stage = next;
      }
    }
  }

  return NextResponse.json({ deliverables: rows, stage });
}
