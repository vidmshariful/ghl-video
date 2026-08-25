/*
 * Attachments, the layer both sides share.
 *
 * The client hands us a logo or a screenshot; we hand them a reference. Either
 * way it is one list on the thing the file belongs to, and this is the only
 * code that writes to the private project-files bucket, so it is the one place
 * that decides what a file may be and how big. The bucket keeps the 10 MB
 * ceiling as a backstop; the friendly errors are here.
 *
 * TWO OWNERS, ONE SET OF RULES
 * ----------------------------
 * A file hangs off a custom project or off an editing request. The rules are
 * identical and were never going to diverge on purpose, so the owner is a
 * parameter rather than a second module. The named exports each side already
 * calls are kept as they are and now sit on top of the general versions, so
 * nothing that worked before changes shape.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = "project-files";

/* What a client can reasonably need to send a video studio, and what we send
   back. Broad on purpose, but never a script or an executable. */
export const ALLOWED_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/webm",
  "application/zip",
  "application/x-zip-compressed",
]);

export type ProjectFileKind = "image" | "video" | "audio" | "pdf" | "doc" | "archive" | "file";

/** A coarse kind for the icon or thumbnail, from the mime type. */
export function fileKind(contentType: string | null): ProjectFileKind {
  const t = (contentType ?? "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  if (t.includes("zip")) return "archive";
  if (t.startsWith("text/") || t.includes("word") || t.includes("sheet") || t.includes("excel") || t.includes("presentation") || t.includes("powerpoint"))
    return "doc";
  return "file";
}

export type ProjectFile = {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string | null;
  kind: ProjectFileKind;
  uploadedBy: "client" | "studio";
  uploaderName: string | null;
  at: string;
  /** short-lived signed link, null only if signing failed */
  url: string | null;
};

/** Every attachment on a project, newest first, each with a 1 hour link. */
/** What a file belongs to. Exactly one, which the table checks too. */
export type FileOwner = { projectId: string } | { deliverableId: string };

const ownerColumn = (o: FileOwner) => ("projectId" in o ? "project_id" : "deliverable_id");
const ownerId = (o: FileOwner) => ("projectId" in o ? o.projectId : o.deliverableId);

export async function listFiles(db: DB, owner: FileOwner): Promise<ProjectFile[]> {
  const { data } = await db
    .from("project_files")
    .select("id, uploaded_by, uploader_name, file_name, storage_path, size_bytes, content_type, created_at")
    .eq(ownerColumn(owner), ownerId(owner))
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];

  const signed = await Promise.all(
    rows.map((r) =>
      db.storage
        .from(BUCKET)
        .createSignedUrl(String(r.storage_path), 3600)
        .then((s) => s.data?.signedUrl ?? null)
        .catch(() => null),
    ),
  );

  return rows.map((r, i) => ({
    id: String(r.id),
    name: String(r.file_name),
    sizeBytes: Number(r.size_bytes ?? 0),
    contentType: (r.content_type as string | null) ?? null,
    kind: fileKind((r.content_type as string | null) ?? null),
    uploadedBy: String(r.uploaded_by) === "studio" ? "studio" : "client",
    uploaderName: (r.uploader_name as string | null) ?? null,
    at: String(r.created_at),
    url: signed[i],
  }));
}

/**
 * Store one file against a project. Validates type and size here so the caller
 * gets a sentence a person can read, not a storage error code. Returns an
 * error string when the file is not allowed, null on success.
 */
export async function addFile(
  db: DB,
  input: {
    owner: FileOwner;
    file: File;
    side: "client" | "studio";
    email: string | null;
    name: string | null;
  },
): Promise<{ error: string } | { ok: true }> {
  const { file } = input;
  if (!file || file.size === 0) return { error: "That file looks empty." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is over 10 MB. Please send a smaller one." };
  if (!ALLOWED_TYPES.has(file.type))
    return { error: `We cannot take a ${file.type || "file of that kind"} here.` };

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${ownerId(input.owner)}/${Date.now()}-${rand}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { error: upErr.message };

  const { error: rowErr } = await db.from("project_files").insert({
    [ownerColumn(input.owner)]: ownerId(input.owner),
    uploaded_by: input.side,
    uploader_email: input.email,
    uploader_name: input.name,
    file_name: file.name.slice(0, 200),
    storage_path: path,
    size_bytes: file.size,
    content_type: file.type || null,
  });
  if (rowErr) {
    /* do not leave an orphan byte-blob behind if the row failed */
    await db.storage.from(BUCKET).remove([path]).catch(() => {});
    return { error: rowErr.message };
  }

  /* tell the other side a file landed. If we asked the client for a logo, the
     producer should not have to go looking for it. Fail-soft: the file is in. */
  if ("deliverableId" in input.owner) {
    await notifyEditingFile(db, input.owner.deliverableId, file.name.slice(0, 200), input);
    return { ok: true };
  }
  try {
    const projectId = input.owner.projectId;
    const { data: p } = await db
      .from("projects")
      .select("title, customer_email")
      .eq("id", projectId)
      .maybeSingle();
    if (p) {
      const { pushAdminNotifications, pushNotification } = await import("@/lib/notifications");
      const vars = {
        project_title: String(p.title),
        file_name: file.name.slice(0, 200),
        who: input.name || input.email || (input.side === "client" ? "The client" : "The studio"),
      };
      if (input.side === "client") {
        await pushAdminNotifications(db, {
          kind: "project_file",
          title: `New file on ${vars.project_title}`,
          body: `${vars.who} added ${vars.file_name}.`,
          href: `custom/${projectId}`,
          vars,
        });
      } else if (p.customer_email) {
        await pushNotification(db, {
          audience: "customer",
          email: String(p.customer_email),
          kind: "project_file",
          title: `We added a file to ${vars.project_title}`,
          body: `${vars.file_name} is in your attachments.`,
          href: `projects/${projectId}`,
          feature: "orders",
          vars,
        });
      }
    }
  } catch (e) {
    console.error("[project-files] notify failed:", e instanceof Error ? e.message : e);
  }
  return { ok: true };
}

/**
 * Remove one attachment, both its row and its bytes. Scoped to a project so a
 * caller can only ever delete a file on a project they were already cleared
 * for. Returns false when the file is not on this project.
 */
export async function removeFile(
  db: DB,
  input: { id: string; owner: FileOwner },
): Promise<boolean> {
  const { data: row } = await db
    .from("project_files")
    .select("id, storage_path")
    .eq("id", input.id)
    .eq(ownerColumn(input.owner), ownerId(input.owner))
    .maybeSingle();
  if (!row) return false;

  await db.storage.from(BUCKET).remove([String(row.storage_path)]).catch(() => {});
  await db.from("project_files").delete().eq("id", input.id);
  return true;
}

/*
 * A file landed on an editing request.
 *
 * Its own event rather than the project one: an editing client never sees a
 * project, and telling the studio "New file on <project>" about a video
 * request would name a thing that does not exist.
 */
async function notifyEditingFile(
  db: DB,
  deliverableId: string,
  fileName: string,
  input: { side: "client" | "studio"; email: string | null; name: string | null },
) {
  try {
    const { data: d } = await db
      .from("order_deliverables")
      .select("title, cycle:subscription_cycles(subscription:subscriptions(customer_email))")
      .eq("id", deliverableId)
      .maybeSingle();
    if (!d) return;
    const cycle = d.cycle as { subscription?: { customer_email?: string } } | null;
    const clientEmail = cycle?.subscription?.customer_email ?? null;
    const vars = {
      title: String(d.title),
      file_name: fileName,
      who: input.name || input.email || (input.side === "client" ? "The client" : "The studio"),
    };
    const { pushAdminNotifications, pushNotification } = await import("@/lib/notifications");
    if (input.side === "client") {
      await pushAdminNotifications(db, {
        kind: "editing_file",
        title: `New file on ${vars.title}`,
        body: `${vars.who} added ${vars.file_name}.`,
        href: "editing",
        vars,
      });
    } else if (clientEmail) {
      await pushNotification(db, {
        audience: "customer",
        email: clientEmail,
        kind: "editing_file",
        title: `We added a file to ${vars.title}`,
        body: `${vars.file_name} is with your request.`,
        href: "editing",
        feature: "subscriptions",
        vars,
      });
    }
  } catch (e) {
    console.error("[project-files] editing notify failed:", e instanceof Error ? e.message : e);
  }
}

/* ---- the names each side already calls, unchanged in shape ---- */

export const listProjectFiles = (db: DB, projectId: string) => listFiles(db, { projectId });

export const addProjectFile = (
  db: DB,
  input: { projectId: string; file: File; side: "client" | "studio"; email: string | null; name: string | null },
) => addFile(db, { ...input, owner: { projectId: input.projectId } });

export const removeProjectFile = (db: DB, input: { id: string; projectId: string }) =>
  removeFile(db, { id: input.id, owner: { projectId: input.projectId } });

/* ---- and the editing side ---- */

export const listDeliverableFiles = (db: DB, deliverableId: string) =>
  listFiles(db, { deliverableId });

export const addDeliverableFile = (
  db: DB,
  input: { deliverableId: string; file: File; side: "client" | "studio"; email: string | null; name: string | null },
) => addFile(db, { ...input, owner: { deliverableId: input.deliverableId } });

export const removeDeliverableFile = (db: DB, input: { id: string; deliverableId: string }) =>
  removeFile(db, { id: input.id, owner: { deliverableId: input.deliverableId } });
