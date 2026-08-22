import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import {
  BUCKET,
  MAX_BYTES,
  guideFor,
  nextVersion,
  ownerOf,
  pathFor,
} from "@/lib/style-guide-doc";

export const runtime = "nodejs";

/*
 * The studio's side of a client's visual style guide.
 *
 * We write the guide, they read it and mark it up, we answer and replace it.
 * That is the same loop a cut goes through, so it is built the same way:
 * versions rather than overwrites, notes pinned to a page rather than a
 * free-floating thread, and a note that has been dealt with gets resolved
 * instead of deleted.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const email = new URL(req.url).searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "Which client?" }, { status: 400 });

  const db = supabaseAdmin();
  return NextResponse.json(await guideFor(db, email));
}

/*
 * Upload a version.
 *
 * PDF only, and checked by what the bytes say rather than by what the name
 * says: a .pdf that is really something else is exactly the upload worth
 * refusing. Each upload is a new version, so a guide already out with the
 * client is never quietly swapped underneath their notes.
 */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the file as a form." }, { status: 400 });

  const email = String(form.get("email") ?? "").trim();
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  const file = form.get("file");
  if (!email) return NextResponse.json({ error: "Which client?" }, { status: 400 });
  if (!(file instanceof File))
    return NextResponse.json({ error: "Pick a PDF to upload." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: "That file is over 25MB. Export it smaller and try again." },
      { status: 400 },
    );

  const bytes = new Uint8Array(await file.arrayBuffer());
  /* %PDF- , the only four bytes that make a PDF a PDF */
  const looksLikePdf =
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!looksLikePdf)
    return NextResponse.json({ error: "That is not a PDF." }, { status: 400 });

  const db = supabaseAdmin();
  const version = await nextVersion(db, email);
  const path = pathFor(email, version);

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data: made, error } = await db
    .from("style_guide_docs")
    .insert({
      customer_email: email.toLowerCase(),
      version,
      path,
      filename: file.name.slice(0, 200) || `style-guide-v${version}.pdf`,
      size_bytes: file.size,
      note: note || null,
      uploaded_by: admin.email ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /* tell them it is there, because a guide nobody reads is a guide that
     gets disagreed with after the first video instead of before it */
  const { pushNotification } = await import("@/lib/notifications");
  await pushNotification(db, {
    audience: "customer",
    email,
    kind: "style_guide",
    title:
      version === 1
        ? "Your style guide is ready to read"
        : `Your style guide has been updated to version ${version}`,
    body: "Open it in Editing, under How we cut for you. Tell us anything you want changed.",
    href: "subscriptions",
  });

  return NextResponse.json({ ok: true, id: made.id, version });
}

/*
 * Answer a note, or mark one dealt with.
 */
export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();

  if (typeof b.resolve === "string") {
    if (!UUID_RE.test(b.resolve))
      return NextResponse.json({ error: "Which note?" }, { status: 400 });
    const { error } = await db
      .from("style_guide_notes")
      .update({
        resolved_at: b.undo ? null : new Date().toISOString(),
        resolved_by: b.undo ? null : (admin.email ?? null),
      })
      .eq("id", b.resolve);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const docId = typeof b.docId === "string" ? b.docId : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!UUID_RE.test(docId))
    return NextResponse.json({ error: "Which guide?" }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (!(await ownerOf(db, docId)))
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const page = Number.isFinite(Number(b.page)) && Number(b.page) > 0 ? Number(b.page) : null;
  const { error } = await db.from("style_guide_notes").insert({
    doc_id: docId,
    page,
    author_side: "studio",
    author_email: admin.email ?? null,
    author_name: "GHL Video",
    body,
    parent_id: typeof b.parentId === "string" && UUID_RE.test(b.parentId) ? b.parentId : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
