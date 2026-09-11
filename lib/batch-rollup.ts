/*
 * A batch follows its shorts.
 *
 * The board refuses to stage a batch by hand, which was right: it is the
 * brief, not a video. But nothing then moved it at all. A batch whose three
 * shorts were all approved sat in "In progress" for good, on the board and on
 * the client's screen, with a 3/3 chip arguing with the column above it. This
 * is the one place a batch's status is written, and it is written from the
 * shorts every time one of them moves.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchStatusFor, isBatch } from "@/lib/editing-credits";

type DB = SupabaseClient;

/**
 * Put a batch where its shorts are.
 *
 * Called after anything that moves a short: a stage change or a cancel from
 * the board, a verdict from the client, new shorts added underneath. Safe to
 * call with any id: a request that is not a batch is left alone, and so is a
 * batch with nothing live under it. Returns the status it settled on.
 */
export async function rollUpBatch(
  db: DB,
  parentId: string | null | undefined,
): Promise<string | null> {
  if (!parentId) return null;
  const { data: parent } = await db
    .from("order_deliverables")
    .select("id, edit_type, status, ready_at, approved_at")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent || !isBatch((parent.edit_type as string | null) ?? null)) return null;

  const { data: kids } = await db
    .from("order_deliverables")
    .select("status, cancelled_at")
    .eq("parent_id", parentId);
  const next = batchStatusFor(
    ((kids ?? []) as { status: string; cancelled_at: string | null }[]).map((k) => ({
      status: k.status,
      cancelledAt: k.cancelled_at,
    })),
  );
  if (!next || next === parent.status) return next;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: next, updated_at: now };
  /* stamped once, the same way the board stamps a video */
  if (next === "ready" && !parent.ready_at) patch.ready_at = now;
  if (next === "approved" && !parent.approved_at) patch.approved_at = now;
  await db.from("order_deliverables").update(patch).eq("id", parentId);
  return next;
}
