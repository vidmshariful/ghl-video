import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Profiles: the person behind a portal login, shared by all three portals.
 * One row per auth user: display name + profile photo. Domain truth stays
 * on admins / customers / partners; this table only carries how the person
 * shows up in the portal chrome (top bar, chat sender names).
 *
 * Photos live in the PUBLIC avatars bucket. The filename carries a
 * timestamp so a new upload always busts browser and CDN caches; the old
 * file is deleted best-effort.
 */

export const AVATAR_BUCKET = "avatars";
export const AVATAR_ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type Profile = {
  displayName: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
};

export function avatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

export async function profileByEmail(db: SupabaseClient, email: string): Promise<Profile> {
  const { data } = await db
    .from("profiles")
    .select("display_name, avatar_path")
    .ilike("email", email)
    .maybeSingle();
  const displayName = (data?.display_name as string | null) ?? null;
  const avatarPath = (data?.avatar_path as string | null) ?? null;
  return { displayName, avatarPath, avatarUrl: avatarPublicUrl(avatarPath) };
}

/** Create or update the caller's profile row (keyed on the auth user id). */
export async function upsertProfile(
  db: SupabaseClient,
  user: { id: string; email: string },
  patch: { displayName?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: user.id,
    email: user.email.toLowerCase(),
  };
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  const { error } = await db.from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) console.error("[profiles] upsert failed:", error.message);
}

/**
 * Store a new profile photo and return its public URL, or an error line.
 * Validates type + size, uploads under a timestamped name, points the
 * profile row at it, then removes the previous file best-effort.
 */
export async function saveAvatar(
  db: SupabaseClient,
  user: { id: string; email: string },
  file: File,
): Promise<{ ok: true; avatarUrl: string } | { ok: false; error: string }> {
  const ext = AVATAR_ALLOWED[file.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  if (file.size > AVATAR_MAX_BYTES)
    return { ok: false, error: "Keep the photo under 2 MB." };

  const { data: existing } = await db
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const path = `${user.id}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(AVATAR_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("[profiles] avatar upload failed:", upErr.message);
    return { ok: false, error: "Could not save the photo. Try again." };
  }

  const { error: rowErr } = await db
    .from("profiles")
    .upsert(
      { user_id: user.id, email: user.email.toLowerCase(), avatar_path: path },
      { onConflict: "user_id" },
    );
  if (rowErr) {
    console.error("[profiles] avatar row update failed:", rowErr.message);
    return { ok: false, error: "Could not save the photo. Try again." };
  }

  const old = (existing?.avatar_path as string | null) ?? null;
  if (old && old !== path) {
    await db.storage.from(AVATAR_BUCKET).remove([old]).catch(() => {});
  }
  return { ok: true, avatarUrl: avatarPublicUrl(path)! };
}

/** Remove the profile photo (back to initials). */
export async function clearAvatar(
  db: SupabaseClient,
  user: { id: string; email: string },
): Promise<void> {
  const { data } = await db
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  const old = (data?.avatar_path as string | null) ?? null;
  await db
    .from("profiles")
    .upsert(
      { user_id: user.id, email: user.email.toLowerCase(), avatar_path: null },
      { onConflict: "user_id" },
    );
  if (old) await db.storage.from(AVATAR_BUCKET).remove([old]).catch(() => {});
}
