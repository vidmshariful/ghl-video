import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureConversation } from "@/lib/chat";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/* Get or create a thread for the acting account: the general thread when
 * no orderId is given, otherwise the thread for that order (which must belong
 * to it). Returns the conversation id the client then opens. */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "messages"))
    return NextResponse.json({ error: "You do not have access to messages." }, { status: 403 });
  const email = ctx.ownerEmail;

  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" && body.orderId ? body.orderId : null;

  if (orderId) {
    const { data: order } = await db
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("customer_email", email)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: customer } = await db
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  try {
    const conv = await ensureConversation(db, {
      email,
      customerId: customer?.id ?? null,
      orderId,
    });
    return NextResponse.json({ id: conv.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
