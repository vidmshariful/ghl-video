import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { hasUnread, threadTitle, type ConversationRow, type OrderJoin } from "@/lib/chat";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/* The acting account's chat threads (general + per project), newest
 * activity first. Team members need the messages grant. */
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "messages"))
    return NextResponse.json({ threads: [], unreadCount: 0 });
  const email = ctx.ownerEmail;

  const { data } = await db
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
