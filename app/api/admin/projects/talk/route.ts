import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureConversation, postMessage } from "@/lib/chat";

export const runtime = "nodejs";

/*
 * The studio's side of talking to a client from a project page.
 *
 * Reads and writes the client's ONE conversation, the same inbox the
 * Messages screen shows, so nothing said here becomes a thread nobody
 * remembers to check. Video feedback lives in the review room instead:
 * pinned to a second of a cut, and resolved rather than answered.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function conversationFor(db: ReturnType<typeof supabaseAdmin>, projectId: string) {
  const { data: project } = await db
    .from("projects")
    .select("id, title, customer_email, customer_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;
  const conv = await ensureConversation(db, {
    email: String(project.customer_email),
    customerId: (project.customer_id as string | null) ?? null,
  });
  return { project, conv };
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!UUID_RE.test(projectId))
    return NextResponse.json({ error: "Which project?" }, { status: 400 });

  const db = supabaseAdmin();
  const found = await conversationFor(db, projectId);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data } = await db
    .from("messages")
    .select("id, sender_role, sender_name, body, created_at")
    .eq("conversation_id", found.conv.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    conversationId: found.conv.id,
    notes: ((data ?? []) as Record<string, unknown>[])
      .map((m) => ({
        id: String(m.id),
        side: String(m.sender_role) === "customer" ? "client" : "studio",
        name:
          (m.sender_name as string | null) ??
          (String(m.sender_role) === "customer" ? "The client" : "GHL Video"),
        body: String(m.body),
        at: String(m.created_at),
      }))
      .reverse(),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { projectId?: string; body?: string };
  const projectId = typeof b.projectId === "string" ? b.projectId : "";
  const text = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!UUID_RE.test(projectId))
    return NextResponse.json({ error: "Which project?" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const db = supabaseAdmin();
  const found = await conversationFor(db, projectId);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await postMessage(db, {
      conversationId: found.conv.id,
      senderRole: "studio",
      senderName: "GHL Video",
      body: `[${String(found.project.title)}] ${text}`,
      attachments: [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const { pushNotification } = await import("@/lib/notifications");
  await pushNotification(db, {
    audience: "customer",
    email: String(found.project.customer_email),
    kind: "message",
    title: `A message about ${String(found.project.title)}`,
    body: text.slice(0, 140),
    href: "messages",
    vars: { project_title: String(found.project.title), text: text.slice(0, 140) },
  });

  return NextResponse.json({ ok: true });
}
