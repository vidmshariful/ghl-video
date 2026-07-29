import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { hasUnread, threadTitle, type ConversationRow, type OrderJoin } from "@/lib/chat";

export const runtime = "nodejs";

/* The signed-in customer's own chat threads (general + per project), newest
 * activity first. Scoped to their verified email. */
export async function GET(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("*, order:orders(invoice_number, product:products(name, sku, metadata))")
    .eq("customer_email", email)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const threads = (data ?? []).map((c) => {
    const conv = c as unknown as ConversationRow;
    const order = (c as { order?: OrderJoin }).order ?? null;
    return {
      id: conv.id,
      orderId: conv.order_id,
      title: threadTitle(conv.order_id, order),
      preview: conv.last_message_preview ?? "",
      lastMessageAt: conv.last_message_at,
      unread: hasUnread(conv, "customer"),
    };
  });

  return NextResponse.json({ threads, unreadCount: threads.filter((t) => t.unread).length });
}
