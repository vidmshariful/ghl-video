import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { ensureConversation, postMessage } from "@/lib/chat";

export const runtime = "nodejs";

/*
 * Talking to the studio from a project page.
 *
 * There is exactly one inbox per client (owner decision, August 2026), so
 * this is not a second thread: it reads and writes the client's ONE
 * conversation, and stamps what they write with the project so the studio
 * knows which job they mean.
 *
 * Video feedback does NOT come through here. A note pinned to 0:12 of a cut
 * belongs to the review, lives on the video, and gets resolved rather than
 * answered. Mixing the two is what made feedback read as chat.
 */

async function guard(req: Request, id: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "messages"))
    return {
      fail: NextResponse.json({ error: "You do not have access to messages." }, { status: 403 }),
    };

  const { data: project } = await db
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  const { data: customer } = await db
    .from("customers")
    .select("id, name")
    .ilike("email", ctx.ownerEmail)
    .maybeSingle();

  const conv = await ensureConversation(db, {
    email: ctx.ownerEmail,
    customerId: (customer?.id as string | null) ?? null,
  });
  return { db, ctx, project, conv, customerName: (customer?.name as string | null) ?? null };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  /* the tail of the one conversation, oldest first, as a preview */
  const { data } = await g.db
    .from("messages")
    .select("id, sender_role, sender_name, body, created_at")
    .eq("conversation_id", g.conv.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    conversationId: g.conv.id,
    notes: ((data ?? []) as Record<string, unknown>[])
      .map((m) => ({
        id: String(m.id),
        side: String(m.sender_role) === "customer" ? "client" : "studio",
        name:
          (m.sender_name as string | null) ??
          (String(m.sender_role) === "customer" ? "You" : "GHL Video"),
        body: String(m.body),
        at: String(m.created_at),
      }))
      .reverse(),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const b = (await req.json().catch(() => ({}))) as { body?: string };
  const text = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  /* the one canonical post: it stamps the preview, the last sender and the
     read marks, so a message from a project page behaves exactly like one
     sent from the inbox itself */
  try {
    await postMessage(g.db, {
      conversationId: g.conv.id,
      senderRole: "customer",
      senderName: g.customerName,
      /* which job they mean, said once, so the studio is not guessing */
      body: `[${String(g.project.title)}] ${text}`,
      attachments: [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
