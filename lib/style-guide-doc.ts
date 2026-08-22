import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * The visual style guide we hand a client, as a document.
 *
 * Shared by both sides of the desk on purpose: the studio and the client
 * read the same versions and the same notes, and the only difference is
 * which of them is allowed to upload. Keeping the shaping here is what stops
 * the two screens drifting into disagreeing about what a note says.
 *
 * The file itself lives in the private intake bucket and is only ever handed
 * out as a signed url with an hour on it, the same rule the brand kit and
 * the intake uploads follow. A style guide carries a client's positioning
 * and their numbers; it does not belong on a public url.
 */

type DB = SupabaseClient;
type Row = Record<string, unknown>;

export const BUCKET = "intake";
export const MAX_BYTES = 25 * 1024 * 1024;
const SIGNED_FOR = 3600;

/** Where a client's guides live. One folder per client, one file per version. */
export function pathFor(email: string, version: number) {
  const safe = email.toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
  return `style-guides/${safe}/v${version}.pdf`;
}

export type Note = {
  id: string;
  page: number | null;
  side: "client" | "studio";
  name: string;
  body: string;
  parentId: string | null;
  resolvedAt: string | null;
  at: string;
};

export type Doc = {
  id: string;
  version: number;
  filename: string;
  sizeBytes: number | null;
  note: string | null;
  uploadedBy: string | null;
  createdAt: string;
  /** signed and hour-limited when we host it, the plain link when we do not */
  url: string | null;
  /** where it actually lives, so the studio knows which rules apply */
  hosted: "ours" | "linked";
  /** null until checked; false means the far end stopped answering */
  linkOk: boolean | null;
};

/**
 * Is a linked guide still there?
 *
 * A link to somebody else's library can be deleted at the far end without
 * telling us, and the first person to find out should not be the client
 * opening it. Cheap enough to run when the studio opens the board.
 */
export async function checkLink(url: string) {
  try {
    const r = await fetch(url, { method: "GET", headers: { range: "bytes=0-1023" } });
    if (!r.ok) return false;
    const type = r.headers.get("content-type") ?? "";
    return /pdf/i.test(type);
  } catch {
    return false;
  }
}

function shapeNote(n: Row): Note {
  return {
    id: String(n.id),
    page: (n.page as number | null) ?? null,
    side: String(n.author_side) === "client" ? "client" : "studio",
    name:
      (n.author_name as string | null) ??
      (String(n.author_side) === "client" ? "The client" : "GHL Video"),
    body: String(n.body),
    parentId: (n.parent_id as string | null) ?? null,
    resolvedAt: (n.resolved_at as string | null) ?? null,
    at: String(n.created_at),
  };
}

/**
 * Every version of a client's guide, newest first, each with a signed link,
 * plus every note across all of them.
 */
export async function guideFor(db: DB, email: string) {
  const { data: rows } = await db
    .from("style_guide_docs")
    .select(
      "id, version, path, external_url, link_ok, filename, size_bytes, note, uploaded_by, created_at",
    )
    .ilike("customer_email", email)
    .order("version", { ascending: false });

  const docs: Doc[] = [];
  for (const d of (rows ?? []) as Row[]) {
    const link = (d.external_url as string | null) ?? null;
    /* a link is handed over as it is; a file we host gets a fresh signature
       with an hour on it, every time it is asked for */
    let url = link;
    if (!link && d.path) {
      const { data: signed } = await db.storage
        .from(BUCKET)
        .createSignedUrl(String(d.path), SIGNED_FOR);
      url = signed?.signedUrl ?? null;
    }
    docs.push({
      id: String(d.id),
      version: Number(d.version),
      filename: (d.filename as string | null) ?? "Style guide",
      sizeBytes: (d.size_bytes as number | null) ?? null,
      note: (d.note as string | null) ?? null,
      uploadedBy: (d.uploaded_by as string | null) ?? null,
      createdAt: String(d.created_at),
      url,
      hosted: link ? "linked" : "ours",
      linkOk: link ? ((d.link_ok as boolean | null) ?? null) : null,
    });
  }

  const ids = docs.map((d) => d.id);
  const { data: noteRows } = ids.length
    ? await db
        .from("style_guide_notes")
        .select(
          "id, doc_id, page, author_side, author_name, body, parent_id, resolved_at, created_at",
        )
        .in("doc_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  const notes: Record<string, Note[]> = {};
  for (const n of (noteRows ?? []) as Row[]) {
    const key = String(n.doc_id);
    (notes[key] ??= []).push(shapeNote(n));
  }

  return { docs, notes };
}

/** The next version number for this client, starting at 1. */
export async function nextVersion(db: DB, email: string) {
  const { data } = await db
    .from("style_guide_docs")
    .select("version")
    .ilike("customer_email", email)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.version ?? 0) + 1;
}

/** Which client a doc belongs to, so a note can be proven to be theirs. */
export async function ownerOf(db: DB, docId: string) {
  const { data } = await db
    .from("style_guide_docs")
    .select("id, customer_email")
    .eq("id", docId)
    .maybeSingle();
  return data ? String(data.customer_email) : null;
}
