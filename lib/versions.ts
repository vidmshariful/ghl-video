/*
 * Every cut of a video, kept.
 *
 * Before this, pasting a new link overwrote the old one. The old cut vanished
 * and a client's note about 0:12 started pointing at a different video where
 * 0:12 is something else. Now each new link becomes the next version, notes
 * record which version they were written about, and order_deliverables.video_url
 * stays the current cut so nothing that reads it had to change.
 *
 * Nothing here deletes anything on its own. The team clears old cuts by hand
 * once a video is approved, which is the owner's call and not a rule the code
 * should be making at three in the morning.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

export type Version = {
  id: string;
  deliverable_id: string;
  version: number;
  video_url: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

/** Every cut of one video, newest first, which is the order a reviewer wants. */
export async function listVersions(db: DB, deliverableId: string): Promise<Version[]> {
  const { data } = await db
    .from("deliverable_versions")
    .select("*")
    .eq("deliverable_id", deliverableId)
    .order("version", { ascending: false });
  return (data ?? []) as Version[];
}

/** The version number a note written right now belongs to. */
export async function currentVersion(db: DB, deliverableId: string): Promise<number | null> {
  const { data } = await db
    .from("deliverable_versions")
    .select("version")
    .eq("deliverable_id", deliverableId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version as number | undefined) ?? null;
}

/**
 * Record a new cut. Returns the version created, or null when there was
 * nothing new to record.
 *
 * Re-saving the same link is a no-op rather than a new version: Tanvir
 * pressing Save twice, or correcting a typo elsewhere in the row, must not
 * invent a cut that never existed.
 */
export async function addVersion(
  db: DB,
  deliverableId: string,
  videoUrl: string,
  by: string,
  note?: string | null,
): Promise<Version | null> {
  const url = videoUrl.trim();
  if (!url) return null;

  const { data: d } = await db
    .from("order_deliverables")
    .select("id, order_id")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!d) return null;

  const { data: latest } = await db
    .from("deliverable_versions")
    .select("version, video_url")
    .eq("deliverable_id", deliverableId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && (latest.video_url as string) === url) return null;

  const next = ((latest?.version as number | undefined) ?? 0) + 1;
  const { data, error } = await db
    .from("deliverable_versions")
    .insert({
      deliverable_id: deliverableId,
      order_id: d.order_id,
      version: next,
      video_url: url,
      note: note?.trim() || null,
      created_by: by,
    })
    .select()
    .single();
  // Two saves racing land on the same version number and the unique index
  // stops the second. That is the guard working, not a failure to report.
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`version failed: ${error.message}`);
  }
  return data as Version;
}

/**
 * Remove one cut. Refuses to remove the current one, because the client is
 * watching it and a video with no link is worse than an old link.
 */
export async function removeVersion(
  db: DB,
  deliverableId: string,
  versionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const versions = await listVersions(db, deliverableId);
  if (versions.length <= 1) return { ok: false, error: "That is the only cut." };
  if (versions[0].id === versionId) {
    return { ok: false, error: "That is the current cut. Upload a newer one first." };
  }
  await db.from("deliverable_versions").delete().eq("id", versionId);
  return { ok: true };
}
