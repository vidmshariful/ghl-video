import { NextResponse } from "next/server";
import { verifyAdminFor } from "@/lib/checkout/admin-auth";
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
 *
 * A batch (deliverableIds) changes the status of several videos in one call:
 * the stage is derived once and a pack going to Ready is one email listing
 * them, not one per video (Premade review, 16 September 2026).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminFor(req, ["orders", "production"]);
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
  const admin = await verifyAdminFor(req, ["orders", "production"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const batch = Array.isArray(body.deliverableIds);
  const ids: string[] = batch
    ? [...new Set((body.deliverableIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0))]
    : typeof body.deliverableId === "string" && body.deliverableId
      ? [body.deliverableId]
      : [];
  if (!ids.length) {
    return NextResponse.json({ error: "Which video?" }, { status: 400 });
  }
  if (batch && (typeof body.videoUrl === "string" || typeof body.note === "string")) {
    return NextResponse.json({ error: "A batch can only change the status." }, { status: 400 });
  }

  let next: Status | null = null;
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as Status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    next = body.status as Status;
  }

  let videoUrl: string | null | undefined;
  if (typeof body.videoUrl === "string") {
    const url = body.videoUrl.trim();
    if (!url) {
      videoUrl = null;
    } else if (/^https?:\/\//i.test(url)) {
      videoUrl = url;
    } else {
      return NextResponse.json(
        { error: "The video link must start with http:// or https://" },
        { status: 400 },
      );
    }
  }

  const db = supabaseAdmin();

  // Scope the rows to this order before writing, so a stray id from one order
  // can never edit another order's video.
  const { data: rows } = await db
    .from("order_deliverables")
    .select("id, status, revision_round, video_url")
    .eq("order_id", id)
    .in("id", ids);
  if (!rows || rows.length !== ids.length) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const becameReady: string[] = [];

  for (const current of rows) {
    const patch: Record<string, unknown> = { updated_at: now };

    if (next) {
      patch.status = next;
      // Stamp the moments worth knowing later. Only on the way in, so
      // re-saving a ready video keeps its first ready date.
      if (next === "ready" && current.status !== "ready") {
        patch.ready_at = now;
        becameReady.push(current.id as string);
      }
      if (next === "approved") patch.approved_at = now;
      /* A studio move into Revisions no longer counts a round. The included
       * round belongs to the client and is spent only by their own "Request
       * changes" (owner's decision, 16 September 2026): moving a card to
       * reflect a WhatsApp message used to burn it. */
    }

    if (videoUrl !== undefined) patch.video_url = videoUrl;
    if (typeof body.note === "string") patch.note = body.note.trim() || null;

    const { error } = await db.from("order_deliverables").update(patch).eq("id", current.id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    /* A new link is a new cut, not a correction. Record it so the old one stays
     * watchable and the client's notes keep pointing at the cut they were about.
     * Re-saving the same link records nothing. */
    if (typeof patch.video_url === "string" && patch.video_url) {
      const { addVersion } = await import("@/lib/versions");
      const v = await addVersion(
        db,
        current.id as string,
        patch.video_url as string,
        admin.email,
        typeof body.versionNote === "string" ? body.versionNote : null,
      );
      if (v) {
        await db.from("order_events").insert({
          order_id: id,
          event_type: "video_version_added",
          payload: { deliverable_id: current.id, version: v.version, by: admin.email },
        });
      }
    }

    await db.from("order_events").insert({
      order_id: id,
      event_type: "deliverable_updated",
      payload: { deliverable_id: current.id, by: admin.email, ...patch },
    });
  }

  /* Ready is the moment the link is released to the client, so it is the
   * moment worth emailing them about. Only on the way IN, so re-saving a
   * ready video does not mail them twice. Several at once is one email. */
  if (becameReady.length === 1) {
    const { sendVideoReadyEmail } = await import("@/lib/email/notify");
    await sendVideoReadyEmail(db, becameReady[0]);
  } else if (becameReady.length > 1) {
    const { sendVideosReadyBatchEmail } = await import("@/lib/email/notify");
    await sendVideosReadyBatchEmail(db, becameReady);
  }

  const all = await listDeliverables(db, id);

  /* The order's stage is a summary of its videos, so recalculate it here
   * rather than making somebody set it a second time. Delivered is never
   * derived: that move emails the client and stays a button. */
  let stage: string | null = null;
  if (next) {
    const { data: order } = await db
      .from("orders")
      .select("fulfillment_stage, intake_completed")
      .eq("id", id)
      .maybeSingle();
    if (order) {
      const derived = deriveStage({
        current: order.fulfillment_stage as string,
        intakeCompleted: Boolean(order.intake_completed),
        statuses: all.map((r) => r.status),
      });
      if (derived && derived !== order.fulfillment_stage) {
        await db
          .from("orders")
          .update({
            fulfillment_stage: derived,
            stage_changed_at: now,
            stage_is_derived: true,
            stage_set_by: null,
          })
          .eq("id", id)
          // never overwrite a delivered order from here
          .neq("fulfillment_stage", "delivered");
        await db.from("order_events").insert({
          order_id: id,
          event_type: "stage_derived",
          payload: { from: order.fulfillment_stage, to: derived },
        });
        stage = derived;
      }

      /* Tanvir approving the last one himself, to close out a client who
       * never came back, finishes the order exactly like the client doing
       * it. Same path, so there is only one way an order completes. */
      const { completeIfAllApproved } = await import("@/lib/review");
      await completeIfAllApproved(db, id).catch(() => false);
    }
  }

  return NextResponse.json({ deliverables: all, stage, updated: ids.length });
}
