import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { ensureMainCarrier } from "@/lib/project-station";
import { addComment, listComments, stamp } from "@/lib/review";
import { pushAdminNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The project's own conversation: one thread the client and the studio
 * both read, on the project page of each. It is the same thread the video
 * review writes into, so a note left at 0:12 and a note left here land in
 * one place instead of two.
 */

async function guard(req: Request, id: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "orders"))
    return { fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };
  const { data: project } = await db
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  return { db, ctx, project };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const { data: main } = await g.db
    .from("order_deliverables")
    .select("id")
    .eq("project_id", id)
    .eq("category", "main")
    .maybeSingle();
  if (!main) return NextResponse.json({ notes: [] });

  const comments = await listComments(g.db, String(main.id));
  return NextResponse.json({
    notes: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "You"),
      body: c.body,
      stamp: stamp(c.at_seconds),
      at: c.created_at,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const b = (await req.json().catch(() => ({}))) as { body?: string };
  const text = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const mainId = await ensureMainCarrier(g.db, id);
  if (!mainId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: cust } = await g.db
    .from("customers")
    .select("name")
    .ilike("email", g.ctx.ownerEmail)
    .maybeSingle();

  const res = await addComment(g.db, {
    deliverableId: mainId,
    side: "client",
    email: g.ctx.ownerEmail,
    name: (cust?.name as string | null) ?? null,
    body: text,
    atSeconds: null,
    parentId: null,
  });
  if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

  await pushAdminNotifications(g.db, {
    kind: "project_note",
    title: `Note on ${String(g.project.title)}`,
    body: text.slice(0, 140),
    href: "/admin/production/",
  });

  return NextResponse.json({ ok: true });
}
