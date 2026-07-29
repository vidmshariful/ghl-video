import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  postMessage,
  shapeMessage,
  uploadChatFiles,
  type ConversationRow,
  type StoredAttachment,
} from "@/lib/chat";

export const runtime = "nodejs";

type DB = ReturnType<typeof supabaseAdmin>;
type MessageRow = {
  id: string;
  sender_role: "customer" | "studio";
  sender_name: string | null;
  body: string;
  attachments: StoredAttachment[] | null;
  created_at: string;
};

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const db = supabaseAdmin();
  const conv = await owned(db, id, email);
  if (!conv) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data } = await db
    .from("messages")
    .select("id, sender_role, sender_name, body, attachments, created_at")
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
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rl = rateLimit(`chat:${email}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please slow down a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { id } = await params;
  const db = supabaseAdmin();
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

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .eq("email", email)
    .maybeSingle();

  const message = await postMessage(db, {
    conversationId: id,
    senderRole: "customer",
    senderName: customer?.name ?? null,
    body,
    attachments,
  });
  return NextResponse.json({ message });
}
