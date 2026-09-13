import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  postMessage,
  shapeMessage,
  uploadChatFiles,
  type ConversationRow,
  type StoredAttachment,
} from "@/lib/chat";
import { contextCan, resolvePortalContext, type PortalContext, actorName } from "@/lib/account-team";

export const runtime = "nodejs";

type DB = ReturnType<typeof supabaseAdmin>;
type MessageRow = {
  id: string;
  sender_role: "customer" | "studio";
  sender_name: string | null;
  body: string;
  attachments: StoredAttachment[] | null;
  created_at: string;
  channel?: string | null;
};

async function pullForThread(db: DB, conv: ConversationRow) {
  try {
    if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) return;
    const [{ loadHlConfig }, { locationId }, { pullConversation }] = await Promise.all([
      import("@/lib/highlevel/config"),
      import("@/lib/highlevel/client"),
      import("@/lib/highlevel/conversations"),
    ]);
    const cfg = await loadHlConfig(db, locationId());
    if (cfg) await pullConversation(db, cfg, conv as unknown as Record<string, unknown>);
  } catch (e) {
    console.error(`[chat] pull from HighLevel failed: ${e instanceof Error ? e.message : e}`);
  }
}

/* The conversation, only if it belongs to this verified email. */
async function owned(db: DB, id: string, email: string): Promise<ConversationRow | null> {
  const { data } = await db
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("customer_email", email)
    .maybeSingle();
  return (data as ConversationRow) ?? null;
}

async function gate(
  db: DB,
  req: Request,
): Promise<PortalContext | { failStatus: 401 | 403 }> {
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return ctx;
  if (!contextCan(ctx, "messages")) return { failStatus: 403 };
  return ctx;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin();
  const ctx = await gate(db, req);
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  const email = ctx.ownerEmail;
  const { id } = await params;
  const conv = await owned(db, id, email);
  if (!conv) return NextResponse.json({ error: "Not found." }, { status: 404 });

  /* anything the studio said from inside HighLevel since we last looked,
     at most once every fifteen seconds; a hiccup there does not hide the thread */
  await pullForThread(db, conv);

  const { data } = await db
    .from("messages")
    .select("id, sender_role, sender_name, body, attachments, created_at, channel")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const messages = await Promise.all(
    ((data ?? []) as MessageRow[]).map((m) => shapeMessage(db, m)),
  );
  await db
    .from("conversations")
    .update({ customer_last_read_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin();
  const ctx = await gate(db, req);
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  const email = ctx.ownerEmail;

  // rate-limit the person typing, not the account they act for
  const rl = rateLimit(`chat:${ctx.selfEmail}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please slow down a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { id } = await params;
  const conv = await owned(db, id, email);
  if (!conv) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!body && files.length === 0) {
    return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });
  }

  let attachments: StoredAttachment[];
  try {
    attachments = await uploadChatFiles(db, id, files);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // the message is signed by whoever typed it, so the studio knows who is
  // talking. Chat already got this right; actorName is the same answer, now
  // shared with reviews, approvals and uploads, which did not.
  const senderName = await actorName(db, ctx);

  const message = await postMessage(db, {
    conversationId: id,
    senderRole: "customer",
    senderName,
    body,
    attachments,
  });
  return NextResponse.json({ message });
}
