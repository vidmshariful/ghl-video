/*
 * The review layer: a client watching a video, saying what they want changed,
 * and the studio answering. Both sides read and write through here so the
 * thread on the job page and the thread in the portal are the same thread.
 *
 * Two rules the rest of the system leans on:
 *
 *  - A comment can be pinned to a second in the video, or not. "The logo at
 *    0:12 is stretched" and "the whole thing feels slow" are both real notes,
 *    and forcing the second one onto a timestamp would be a lie.
 *  - Asking for changes raises the video's round. Notes stay stamped with the
 *    round they were written in, so round one reads as history rather than
 *    being muddled into round two.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { REVISIONS_INCLUDED, type DeliverableStatus } from "@/lib/deliverable-status";

type DB = SupabaseClient;

export type ReviewComment = {
  id: string;
  deliverable_id: string;
  order_id: string;
  author_side: "client" | "studio";
  author_email: string;
  author_name: string | null;
  body: string;
  at_seconds: number | null;
  /* which production-line stage this note is about, null for a plain video
     review note written before per-stage feedback existed */
  stage: string | null;
  revision_round: number;
  version: number | null;
  parent_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

/** mm:ss for a moment in a video, the way a client would say it */
export function stamp(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Every note on one video, oldest first, which is how a thread reads. */
export async function listComments(db: DB, deliverableId: string): Promise<ReviewComment[]> {
  const { data } = await db
    .from("deliverable_comments")
    .select("*")
    .eq("deliverable_id", deliverableId)
    .order("created_at");
  return (data ?? []) as ReviewComment[];
}

/**
 * Unanswered CLIENT notes per video, for the badge on the job page.
 *
 * Only the client's side counts. The badge says "notes to answer", and our own
 * replies are not something to answer: counting them made a video the studio
 * had already responded to look like it was still waiting.
 */
export async function openCommentCounts(
  db: DB,
  orderId: string,
): Promise<Record<string, number>> {
  const { data } = await db
    .from("deliverable_comments")
    .select("deliverable_id")
    .eq("order_id", orderId)
    .eq("author_side", "client")
    .is("parent_id", null)
    .is("resolved_at", null);
  const out: Record<string, number> = {};
  for (const c of data ?? []) {
    out[c.deliverable_id as string] = (out[c.deliverable_id as string] ?? 0) + 1;
  }
  return out;
}

export type NewComment = {
  deliverableId: string;
  side: "client" | "studio";
  email: string;
  name?: string | null;
  body: string;
  atSeconds?: number | null;
  /** which production-line stage this note is about, null for the plain
      video review that predates per-stage feedback */
  stage?: string | null;
  /** set when this note answers another note */
  parentId?: string | null;
};

/**
 * Post a note. Returns null when the video does not exist, so callers can
 * answer 404 without a second lookup.
 *
 * The round is taken from the video rather than from the caller: the client's
 * browser must not be able to file a note under a round that suits it.
 */
export async function addComment(
  db: DB,
  c: NewComment,
): Promise<{ comment: ReviewComment; orderId: string } | null> {
  const body = c.body.trim();
  if (!body) return null;

  const { data: d } = await db
    .from("order_deliverables")
    .select("id, order_id, revision_round")
    .eq("id", c.deliverableId)
    .maybeSingle();
  if (!d) return null;

  const at =
    c.atSeconds == null || !Number.isFinite(c.atSeconds) || c.atSeconds < 0
      ? null
      : Math.round(c.atSeconds * 100) / 100;

  // which cut this note is about, so it keeps its meaning after the next one
  const { currentVersion } = await import("@/lib/versions");
  const version = await currentVersion(db, d.id as string);

  const { data, error } = await db
    .from("deliverable_comments")
    .insert({
      deliverable_id: d.id,
      order_id: d.order_id,
      author_side: c.side,
      author_email: c.email.toLowerCase(),
      author_name: c.name ?? null,
      body,
      at_seconds: at,
      stage: c.stage ?? null,
      revision_round: d.revision_round as number,
      version,
      parent_id: c.parentId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`comment failed: ${error.message}`);

  return { comment: data as ReviewComment, orderId: d.order_id as string };
}

/** Mark a note dealt with. Studio side only; a client marks nothing resolved. */
export async function resolveComment(
  db: DB,
  commentId: string,
  by: string,
  resolved: boolean,
): Promise<void> {
  await db
    .from("deliverable_comments")
    .update(
      resolved
        ? { resolved_at: new Date().toISOString(), resolved_by: by }
        : { resolved_at: null, resolved_by: null },
    )
    .eq("id", commentId);
}

/**
 * The client's verdict on a video.
 *
 * approve  -> approved, and every open note on it is closed, because the
 *             client has just said the video is right
 * changes  -> revisions, and the round rises so the next notes are round two
 *
 * Only allowed on a video the client can actually watch. Approving something
 * that was never sent to them would be nonsense, and it is the kind of thing a
 * crafted request would try.
 */
export async function clientVerdict(
  db: DB,
  deliverableId: string,
  verdict: "approve" | "changes",
  by: string,
): Promise<{ ok: true; status: DeliverableStatus } | { ok: false; error: string }> {
  const { data: d } = await db
    .from("order_deliverables")
    .select("id, order_id, status, revision_round")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!d) return { ok: false, error: "Video not found." };

  const watchable = ["ready", "revisions", "approved"];
  if (!watchable.includes(d.status as string)) {
    return { ok: false, error: "That video is not ready to review yet." };
  }
  // Approving twice is harmless; asking for a second round is not, so the
  // limit is enforced here as well as hidden in the UI.
  if (verdict === "changes") {
    if (d.status === "approved") {
      return { ok: false, error: "You have already approved this video. Message us and we will re-open it." };
    }
    if ((d.revision_round as number) >= REVISIONS_INCLUDED) {
      return {
        ok: false,
        error: "Your included revision round has been used. Message us about anything else and we will sort it out.",
      };
    }
  }

  const now = new Date().toISOString();
  if (verdict === "approve") {
    await db
      .from("order_deliverables")
      .update({ status: "approved", approved_at: now, updated_at: now })
      .eq("id", d.id);
    await db
      .from("deliverable_comments")
      .update({ resolved_at: now, resolved_by: by })
      .eq("deliverable_id", d.id)
      .is("resolved_at", null);
    await resyncOrderStage(db, d.order_id as string);
    await completeIfAllApproved(db, d.order_id as string);
    return { ok: true, status: "approved" };
  }

  await db
    .from("order_deliverables")
    .update({
      status: "revisions",
      revision_round: (d.revision_round as number) + 1,
      updated_at: now,
    })
    .eq("id", d.id);
  await resyncOrderStage(db, d.order_id as string);
  return { ok: true, status: "revisions" };
}

/**
 * The client approving the last video IS the order finishing, so the order
 * closes itself rather than waiting for somebody to press a button recording
 * what the system already knows (owner's decision, August 2026).
 *
 * The wrap-up email goes out exactly once. The conditional update is what
 * guarantees it: only the call that actually moves the order off its previous
 * stage sends anything, so two approvals landing together cannot double up.
 */
export async function completeIfAllApproved(db: DB, orderId: string): Promise<boolean> {
  const { data: rows } = await db
    .from("order_deliverables")
    .select("status")
    .eq("order_id", orderId);
  const list = rows ?? [];
  if (!list.length) return false;
  if (!list.every((r) => r.status === "approved")) return false;

  const { data: moved } = await db
    .from("orders")
    .update({
      fulfillment_stage: "delivered",
      stage_changed_at: new Date().toISOString(),
      stage_is_derived: true,
    })
    .eq("id", orderId)
    .neq("fulfillment_stage", "delivered")
    .select("id")
    .maybeSingle();
  if (!moved) return false;

  await db.from("order_events").insert({
    order_id: orderId,
    event_type: "order_completed",
    payload: { reason: "every video approved by the client" },
  });

  /* Telling people is fail-soft. The order IS complete once the update above
   * lands, and a mail or notification problem must never turn a client's
   * approval into an error on their screen. */
  try {
    const { sendOrderDeliveredEmail } = await import("@/lib/email/notify");
    await sendOrderDeliveredEmail(db, orderId);
  } catch (e) {
    console.error("[complete] wrap-up email failed:", e instanceof Error ? e.message : e);
  }

  try {
    const { pushNotification, pushOrderOwnerNotification } = await import("@/lib/notifications");
    const { data: o } = await db
      .from("orders")
      .select("customer_email, products(name)")
      .eq("id", orderId)
      .maybeSingle();
    const product = (o?.products as unknown as { name?: string } | null)?.name ?? "their order";
    await pushOrderOwnerNotification(db, orderId, {
      kind: "order_completed",
      title: `Finished: ${product}`,
      body: "Every video approved. The client has their wrap-up.",
      href: "production",
      vars: { product_name: product },
    });
    if (o?.customer_email) {
      await pushNotification(db, {
        audience: "customer",
        email: o.customer_email as string,
        kind: "order_completed",
        title: "Your order is complete",
        body: "Every video is approved and yours to use.",
        href: "videos",
        vars: { product_name: product },
        feature: "orders",
      });
    }
  } catch (e) {
    console.error("[complete] notifications failed:", e instanceof Error ? e.message : e);
  }
  return true;
}

/**
 * Pull the order's stage back in line with its videos.
 *
 * The studio's own edits re-derive inside the deliverables route, but a client
 * verdict changes a video from the portal and has to do the same. Without this
 * a client asking for changes left the order sitting in Review while the video
 * it belongs to had gone back to revisions, so the job showed as finished on a
 * board where work had just restarted.
 */
export async function resyncOrderStage(db: DB, orderId: string): Promise<void> {
  const { deriveStage } = await import("@/lib/order-stage");
  const [{ data: order }, { data: rows }] = await Promise.all([
    db.from("orders").select("fulfillment_stage, intake_completed").eq("id", orderId).maybeSingle(),
    db.from("order_deliverables").select("status").eq("order_id", orderId),
  ]);
  if (!order) return;
  const next = deriveStage({
    current: order.fulfillment_stage as string,
    intakeCompleted: Boolean(order.intake_completed),
    statuses: (rows ?? []).map((r) => r.status as DeliverableStatus),
  });
  if (!next || next === order.fulfillment_stage) return;
  await db
    .from("orders")
    .update({
      fulfillment_stage: next,
      stage_changed_at: new Date().toISOString(),
      stage_is_derived: true,
      stage_set_by: null,
    })
    .eq("id", orderId)
    .neq("fulfillment_stage", "delivered");
}
