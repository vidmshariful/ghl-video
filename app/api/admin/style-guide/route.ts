import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import {
  BUCKET,
  MAX_BYTES,
  checkLink,
  guideFor,
  nextVersion,
  ownerOf,
  pathFor,
} from "@/lib/style-guide-doc";

/* said once, because a link and an upload both need to say it */
async function tellThem(
  db: ReturnType<typeof supabaseAdmin>,
  email: string,
  version: number,
) {
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
    vars: {
      headline:
        version === 1
          ? "Your style guide is ready to read"
          : `Your style guide has been updated to version ${version}`,
      version: String(version),
    },
  });
}

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
  const guide = await guideFor(db, email);

  /*
   * Re-check the current guide if it lives somewhere else.
   *
   * Only the current one, and only on our side: a link can be deleted at the
   * far end without telling anybody, and we would rather find that here than
   * have a client open a dead page. Older versions are left alone so opening
   * a board never turns into a dozen outbound requests.
   */
  const current = guide.docs[0];
  if (current?.hosted === "linked" && current.url) {
    const ok = await checkLink(current.url);
    if (ok !== current.linkOk) {
      await db
        .from("style_guide_docs")
        .update({ link_ok: ok, link_checked_at: new Date().toISOString() })
        .eq("id", current.id);
    }
    current.linkOk = ok;
  }

  return NextResponse.json(guide);
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
  const link = String(form.get("url") ?? "").trim().slice(0, 1000);
  const file = form.get("file");
  if (!email) return NextResponse.json({ error: "Which client?" }, { status: 400 });

  /*
   * A link, which is the usual way now: the guide lives in the HighLevel
   * media library and costs us no storage. Checked before it is saved, so a
   * typo is caught here rather than by the client finding a dead page.
   */
  if (link && !(file instanceof File && file.size > 0)) {
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      return NextResponse.json({ error: "That is not a web address." }, { status: 400 });
    }
    if (parsed.protocol !== "https:")
      return NextResponse.json(
        { error: "The link has to start with https." },
        { status: 400 },
      );

    const reachable = await checkLink(link);
    if (!reachable)
      return NextResponse.json(
        {
          error:
            "That link did not answer with a PDF. Open it in a new tab and check it is the right one, and that it is shared publicly.",
        },
        { status: 400 },
      );

    const dbLink = supabaseAdmin();
    const version = await nextVersion(dbLink, email);
    const { data: madeLink, error: linkErr } = await dbLink
      .from("style_guide_docs")
      .insert({
        customer_email: email.toLowerCase(),
        version,
        external_url: link,
        filename: decodeURIComponent(parsed.pathname.split("/").pop() ?? "").slice(0, 200) ||
          `style-guide-v${version}.pdf`,
        note: note || null,
        uploaded_by: admin.email ?? null,
        link_ok: true,
        link_checked_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    await tellThem(dbLink, email, version);
    return NextResponse.json({ ok: true, id: madeLink.id, version });
  }

  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Paste a link to the guide, or pick a PDF to upload." },
      { status: 400 },
    );
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
  await tellThem(db, email, version);

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
