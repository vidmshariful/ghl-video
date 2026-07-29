import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureConversation } from "@/lib/chat";

export const runtime = "nodejs";

/* Get or create a thread for the signed-in customer: the general thread when
 * no orderId is given, otherwise the thread for that order (which must belong
 * to them). Returns the conversation id the client then opens. */
export async function POST(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" && body.orderId ? body.orderId : null;
  const db = supabaseAdmin();

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
