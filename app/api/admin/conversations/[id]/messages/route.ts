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
  const messages = await Promise.all(
    ((data ?? []) as MessageRow[]).map((m) => shapeMessage(db, m)),
  );
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

  const message = await postMessage(db, {
    conversationId: id,
    senderRole: "studio",
    senderName: admin.email,
    body,
    attachments,
  });
  return NextResponse.json({ message });
}
