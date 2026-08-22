import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { guideFor, ownerOf } from "@/lib/style-guide-doc";

export const runtime = "nodejs";

/*
 * The client's side of the style guide we wrote for them.
 *
 * They can read every version and mark up the current one. They cannot
 * upload, because the guide is ours to write, and they cannot resolve a
 * note, because "dealt with" is a claim about work we have done. Everything
 * else is the same document the studio sees.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "subscriptions"))
    return {
      fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }),
    };

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .ilike("email", ctx.ownerEmail)
    .maybeSingle();

  return { db, ctx, name: (customer?.name as string | null) ?? null };
}

export async function GET(req: Request) {
  const g = await guard(req);
  if ("fail" in g) return g.fail;
  return NextResponse.json(await guideFor(g.db, g.ctx.ownerEmail));
}

/*
 * Leave a note on a page.
 *
 * The same shape as a note on a second of a cut: it says which page it is
 * about, so nobody has to write "on the page with the colours" and hope.
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if ("fail" in g) return g.fail;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const docId = typeof b.docId === "string" ? b.docId : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!UUID_RE.test(docId))
    return NextResponse.json({ error: "Which guide?" }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  /* prove the guide is theirs before writing a note onto it */
  const owner = await ownerOf(g.db, docId);
  if (!owner || owner.toLowerCase() !== g.ctx.ownerEmail.toLowerCase())
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const page = Number.isFinite(Number(b.page)) && Number(b.page) > 0 ? Number(b.page) : null;
  const { error } = await g.db.from("style_guide_notes").insert({
    doc_id: docId,
    page,
    author_side: "client",
    author_email: g.ctx.ownerEmail,
    author_name: g.name,
    body,
    parent_id: typeof b.parentId === "string" && UUID_RE.test(b.parentId) ? b.parentId : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { pushAdminNotifications } = await import("@/lib/notifications");
  await pushAdminNotifications(g.db, {
    kind: "style_guide_note",
    title: `Style guide note from ${g.name ?? g.ctx.ownerEmail}`,
    body: `${page ? `Page ${page}: ` : ""}${body.slice(0, 120)}`,
    href: "/admin/editing/",
  });

  return NextResponse.json({ ok: true });
}
