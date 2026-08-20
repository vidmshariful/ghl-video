import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import {
  postMessage,
  shapeMessage,
  threadTitle,
  uploadChatFiles,
  type ConversationRow,
  type OrderJoin,
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
type CustomerJoin = { name: string | null; company: string | null } | null;

async function loadConversation(db: DB, id: string) {
  const { data } = await db
    .from("conversations")
    .select(
      "*, customer:customers(name, company), order:orders(invoice_number, product:products(name, sku, metadata))",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const db = supabaseAdmin();
  const row = await loadConversation(db, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const conv = row as unknown as ConversationRow;
  const order = (row as { order?: OrderJoin }).order ?? null;
  const customer = (row as { customer?: CustomerJoin }).customer ?? null;

  const { data } = await db
    .from("messages")
    .select("id, sender_role, sender_name, body, attachments, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  const chat = await Promise.all(
    ((data ?? []) as MessageRow[]).map((m) => shapeMessage(db, m)),
  );

  /*
   * The unified part: what the platform did around this conversation,
   * merged in at read time, HighLevel-inbox style.
   *
   * Read-time on purpose. Writing system rows into messages would mean
   * every email hook also writes chat, two records of one event, and the
   * day they disagree nobody knows which lied. The log and the updates
   * table already hold the truth; this route just deals one timeline.
   *
   * An order thread carries its order's updates. The general thread
   * carries the emails, because emails belong to the person, not to one
   * order. The client's own portal thread gets none of this: "your email
   * failed" is our operational laundry, not their conversation.
   */
  const events: { id: string; body: string; createdAt: string }[] = [];

  if (conv.order_id) {
    const { data: updates } = await db
      .from("order_updates")
      .select("id, body, created_at")
      .eq("order_id", conv.order_id)
      .order("created_at", { ascending: true });
    for (const u of updates ?? []) {
      events.push({
        id: `update-${u.id}`,
        body: `Order update posted: ${String(u.body).slice(0, 200)}`,
        createdAt: String(u.created_at),
      });
    }
  } else {
    const { data: mails } = await db
      .from("email_log")
      .select("id, subject, status, error, template_key, source, created_at")
      .ilike("to_email", conv.customer_email)
      .order("created_at", { ascending: true })
      .limit(100);
    for (const e of mails ?? []) {
      const what = String(e.template_key ?? e.source);
      const word =
        e.status === "sent"
          ? "Email sent"
          : e.status === "failed"
            ? "EMAIL FAILED"
            : e.status === "skipped"
              ? "Email skipped"
              : "Email held by their preferences";
      events.push({
        id: `mail-${e.id}`,
        body: `${word}: ${String(e.subject)} (${what})${e.status === "failed" && e.error ? `. ${String(e.error).slice(0, 160)}` : ""}`,
        createdAt: String(e.created_at),
      });
    }
  }

  const messages = [
    ...chat,
    ...events.map((e) => ({
      id: e.id,
      senderRole: "studio" as const,
      senderName: null,
      body: e.body,
      attachments: [],
      createdAt: e.createdAt,
      kind: "event" as const,
    })),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  await db
    .from("conversations")
    .update({ studio_last_read_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    thread: {
      id: conv.id,
      orderId: conv.order_id,
      title: threadTitle(conv.order_id, order),
      customerName: customer?.name || conv.customer_email,
      customerEmail: conv.customer_email,
      company: customer?.company ?? null,
    },
    messages,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: conv } = await db.from("conversations").select("id").eq("id", id).maybeSingle();
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

  // sign with the teammate's display name, not their raw email
  const [profile, { data: adminRow }] = await Promise.all([
    import("@/lib/profiles").then((m) => m.profileByEmail(db, admin.email)),
    db.from("admins").select("name").ilike("email", admin.email).maybeSingle(),
  ]);
  const senderName =
    profile.displayName || ((adminRow?.name as string | null) ?? null) || admin.email;

  const message = await postMessage(db, {
    conversationId: id,
    senderRole: "studio",
    senderName,
    body,
    attachments,
  });
  return NextResponse.json({ message });
}
