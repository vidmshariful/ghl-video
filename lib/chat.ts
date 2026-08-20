import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Shared chat plumbing for the portal + admin message routes: file uploads to
 * the private `chat` bucket, short-lived signed-URL reads, thread get-or-create,
 * and the single postMessage path that inserts a row and refreshes the
 * conversation's denormalized last_message_* + the sender's read stamp.
 */
export type StoredAttachment = { path: string; name: string; size: number; type: string };
export type SignedAttachment = { name: string; size: number; type: string; url: string | null };
export type SenderRole = "customer" | "studio";

export type ConversationRow = {
  id: string;
  customer_email: string;
  customer_id: string | null;
  order_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_role: SenderRole | null;
  customer_last_read_at: string | null;
  studio_last_read_at: string | null;
  created_at: string;
};
type MessageRow = {
  id: string;
  sender_role: SenderRole;
  sender_name: string | null;
  body: string;
  attachments: StoredAttachment[] | null;
  created_at: string;
};
export type ShapedMessage = {
  id: string;
  senderRole: SenderRole;
  senderName: string | null;
  body: string;
  attachments: SignedAttachment[];
  createdAt: string;
};

type DB = SupabaseClient;

export const CHAT_BUCKET = "chat";
export const CHAT_ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
  "text/plain",
];
export const CHAT_MAX_BYTES = 10_485_760; // 10 MB
export const CHAT_MAX_FILES = 6;

export function previewFrom(body: string, attachments: StoredAttachment[]): string {
  const t = body.trim();
  if (t) return t.slice(0, 140);
  if (attachments.length === 0) return "";
  return attachments.length > 1 ? `${attachments.length} attachments` : attachments[0].name || "Attachment";
}

export async function signAttachments(
  db: DB,
  attachments: StoredAttachment[] | null,
): Promise<SignedAttachment[]> {
  return Promise.all(
    (attachments ?? []).map(async (a) => {
      // SVGs download rather than render inline (script-execution risk on the
      // storage origin), same rule as the intake bucket.
      const opts =
        a.type === "image/svg+xml" || a.name.toLowerCase().endsWith(".svg")
          ? { download: true }
          : undefined;
      const { data } = await db.storage.from(CHAT_BUCKET).createSignedUrl(a.path, 3600, opts);
      return { name: a.name, size: a.size, type: a.type, url: data?.signedUrl ?? null };
    }),
  );
}

export async function shapeMessage(db: DB, row: MessageRow): Promise<ShapedMessage> {
  return {
    id: row.id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    body: row.body,
    attachments: await signAttachments(db, row.attachments),
    createdAt: row.created_at,
  };
}

export async function uploadChatFiles(
  db: DB,
  conversationId: string,
  files: File[],
): Promise<StoredAttachment[]> {
  const out: StoredAttachment[] = [];
  for (const file of files.slice(0, CHAT_MAX_FILES)) {
    if (!CHAT_ALLOWED.includes(file.type)) {
      throw new Error(`Unsupported file type (${file.type || "unknown"}).`);
    }
    if (file.size > CHAT_MAX_BYTES) throw new Error("A file is larger than 10 MB.");
    const ext = (file.name.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8);
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${conversationId}/${Date.now()}-${rand}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage
      .from(CHAT_BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    out.push({ path, name: file.name.slice(0, 200), size: file.size, type: file.type });
  }
  return out;
}

/* Find or create the general (orderId null) or per-order thread for an email. */
export async function ensureConversation(
  db: DB,
  args: { email: string; customerId: string | null; orderId?: string | null },
): Promise<ConversationRow> {
  /*
   * One inbox per client (owner decision, August 2026). orderId is still
   * accepted so old callers keep compiling, and deliberately ignored: chat
   * used to open a thread per order plus a general one, which made a single
   * client read as three inboxes and let their reply land in whichever tab
   * was open. Migration 0066 merged what existed; this is what stops it
   * coming back.
   */
  const { email, customerId } = args;
  const find = () =>
    db.from("conversations").select("*").eq("customer_email", email).is("order_id", null);
  const { data: existing } = await find().maybeSingle();
  if (existing) return existing as ConversationRow;

  const { data, error } = await db
    .from("conversations")
    .insert({ customer_email: email, customer_id: customerId, order_id: null })
    .select("*")
    .single();
  if (!error && data) return data as ConversationRow;

  // Lost a create race on the unique index: the row now exists, so refetch.
  const { data: again } = await find().maybeSingle();
  if (again) return again as ConversationRow;
  throw new Error(error?.message ?? "Could not open the conversation.");
}

export async function postMessage(
  db: DB,
  args: {
    conversationId: string;
    senderRole: SenderRole;
    senderName: string | null;
    body: string;
    attachments: StoredAttachment[];
  },
): Promise<ShapedMessage> {
  const { conversationId, senderRole, senderName, body, attachments } = args;
  const { data, error } = await db
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_role: senderRole,
      sender_name: senderName,
      body,
      attachments,
    })
    .select("id, sender_role, sender_name, body, attachments, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not send the message.");

  const row = data as MessageRow;
  await db
    .from("conversations")
    .update({
      last_message_at: row.created_at,
      last_message_preview: previewFrom(body, attachments),
      last_sender_role: senderRole,
      // The sender has, by definition, read up to their own message.
      ...(senderRole === "customer"
        ? { customer_last_read_at: row.created_at }
        : { studio_last_read_at: row.created_at }),
    })
    .eq("id", conversationId);

  return shapeMessage(db, row);
}

/* A conversation's order join, used to title per-order threads. */
export type OrderJoin = {
  invoice_number: string | null;
  product: { name: string; sku: string; metadata: { code?: string } | null } | null;
} | null;

export function orderCode(order: OrderJoin): string | null {
  return order?.product?.metadata?.code ?? order?.product?.sku?.toUpperCase() ?? null;
}

export function threadTitle(orderId: string | null, order: OrderJoin): string {
  /* one inbox per client now, so the title is simply what it is. The order
     branch survives only for anything unmigrated in flight. */
  if (!orderId) return "Inbox";
  const code = orderCode(order);
  return `${code ? code + " " : ""}${order?.product?.name ?? "Your project"}`;
}

/* Has this side got messages it hasn't seen? (cheap, denormalized-column only) */
export function hasUnread(c: ConversationRow, side: SenderRole): boolean {
  if (!c.last_message_at || !c.last_sender_role) return false;
  const other: SenderRole = side === "studio" ? "customer" : "studio";
  if (c.last_sender_role !== other) return false;
  const read = side === "studio" ? c.studio_last_read_at : c.customer_last_read_at;
  return !read || new Date(c.last_message_at) > new Date(read);
}
