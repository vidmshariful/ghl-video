import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * Invoice actions. "sent" stamps sent_at (the team sent the link). "void"
 * closes the invoice AND deactivates its backing product, so the pay link
 * stops working (getActiveProductBySku returns null for inactive products).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = body.action;
  const db = supabaseAdmin();

  if (action === "sent") {
    await db.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", id);
    /* the link goes to the client with the invoice itself, so nobody pastes
       it into a message by hand. Fail-soft: the stamp above already stands. */
    try {
      const { sendInvoiceSentEmail } = await import("@/lib/email/notify");
      await sendInvoiceSentEmail(db, id);
    } catch (e) {
      console.error("[invoice] sent email failed:", e instanceof Error ? e.message : e);
    }
  } else if (action === "void") {
    const { data: inv } = await db
      .from("invoices")
      .update({ status: "void" })
      .eq("id", id)
      .select("product_id")
      .single();
    if (inv?.product_id) {
      await db.from("products").update({ active: false }).eq("id", inv.product_id);
    }
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
