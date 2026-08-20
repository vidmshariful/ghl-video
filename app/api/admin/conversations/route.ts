import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { hasUnread, threadTitle, type ConversationRow, type OrderJoin } from "@/lib/chat";

export const runtime = "nodejs";

type CustomerJoin = { name: string | null; company: string | null } | null;

/* Every chat thread that has activity, newest first, with unread (from the
 * studio's side) flagged. Powers the admin inbox and its nav badge. */
export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("conversations")
    .select(
      "*, customer:customers(name, company), order:orders(invoice_number, product:products(name, sku, metadata))",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const threads = (data ?? [])
    .filter((c) => (c as unknown as ConversationRow).last_message_at)
    .map((c) => {
      const conv = c as unknown as ConversationRow;
      const order = (c as { order?: OrderJoin }).order ?? null;
      const customer = (c as { customer?: CustomerJoin }).customer ?? null;
      return {
        id: conv.id,
        orderId: conv.order_id,
        title: threadTitle(conv.order_id, order),
        customerId: (c as { customer_id?: string | null }).customer_id ?? null,
        customerName: customer?.name || conv.customer_email,
        customerEmail: conv.customer_email,
        company: customer?.company ?? null,
        preview: conv.last_message_preview ?? "",
        lastMessageAt: conv.last_message_at,
        unread: hasUnread(conv, "studio"),
      };
    });

  return NextResponse.json({ threads, unreadCount: threads.filter((t) => t.unread).length });
}
