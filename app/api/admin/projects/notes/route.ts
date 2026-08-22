import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureMainCarrier } from "@/lib/project-station";
import { addComment, listComments, stamp } from "@/lib/review";
import { pushNotification } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The studio's side of a project's conversation thread. Same thread the
 * client reads on their project page and the review screen writes into.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: "Which project?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: main } = await db
    .from("order_deliverables")
    .select("id")
    .eq("project_id", projectId)
    .eq("category", "main")
    .maybeSingle();
  if (!main) return NextResponse.json({ notes: [] });

  const comments = await listComments(db, String(main.id));
  return NextResponse.json({
    notes: comments.map((c) => ({
      id: c.id,
      side: c.author_side,
      name: c.author_name ?? (c.author_side === "studio" ? "GHL Video" : "The client"),
      body: c.body,
      stamp: stamp(c.at_seconds),
      at: c.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { projectId?: string; body?: string };
  const projectId = typeof b.projectId === "string" ? b.projectId : "";
  const text = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: "Which project?" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: project } = await db
    .from("projects")
    .select("id, title, customer_email")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const mainId = await ensureMainCarrier(db, projectId);
  if (!mainId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const res = await addComment(db, {
    deliverableId: mainId,
    side: "studio",
    email: admin.email,
    name: "GHL Video",
    body: text,
    atSeconds: null,
    parentId: null,
  });
  if (!res) return NextResponse.json({ error: "Could not post that." }, { status: 400 });

  await pushNotification(db, {
    audience: "customer",
    email: String(project.customer_email),
    kind: "project_note",
    title: `A note on ${String(project.title)}`,
    body: text.slice(0, 140),
    href: "custom",
  });

  return NextResponse.json({ ok: true });
}
