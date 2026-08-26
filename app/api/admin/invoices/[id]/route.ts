import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseInvoiceInput } from "@/lib/invoices";

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
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  const db = supabaseAdmin();

  if (action === "edit") {
    /*
     * Rewrite an invoice that has not been paid.
     *
     * A bill goes out with the wrong number on it more often than anybody
     * would like, and until now the only remedy was to void it and raise a
     * second one, which leaves the client holding two links and wondering
     * which is real. The token does not change here, so the link already
     * sent keeps working and now shows the corrected bill.
     *
     * Two things make this safe. It refuses once money has moved, because an
     * invoice somebody has paid is a record of what they paid and not a
     * document to rewrite. And it reprices the backing product in the same
     * breath: that product is what checkout actually charges, so an invoice
     * edited without it would show one figure and take another.
     */
    const { data: existing } = await db
      .from("invoices")
      .select("id, status, product_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.status === "void") {
      return NextResponse.json({ error: "This invoice is void. Raise a new one." }, { status: 400 });
    }
    if (existing.product_id) {
      const { data: paidOrder } = await db
        .from("orders")
        .select("id")
        .eq("product_id", existing.product_id)
        .eq("status", "paid")
        .maybeSingle();
      if (paidOrder) {
        return NextResponse.json(
          { error: "This invoice is paid. It cannot be changed." },
          { status: 400 },
        );
      }
    }

    const parsed = parseInvoiceInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const inv = parsed.invoice;

    /* the price the client is actually charged lives on the product */
    if (existing.product_id) {
      const { error: pErr } = await db
        .from("products")
        .update({
          name: inv.lineItems[0].description.slice(0, 120),
          price_cents: inv.totalCents,
        })
        .eq("id", existing.product_id);
      if (pErr) {
        return NextResponse.json({ error: "Could not update the invoice." }, { status: 500 });
      }
    }

    const { error } = await db
      .from("invoices")
      .update({
        customer_name: inv.customerName || null,
        customer_email: inv.customerEmail,
        customer_company: inv.customerCompany || null,
        line_items: inv.lineItems,
        subtotal_cents: inv.subtotalCents,
        discount_kind: inv.discountValue ? inv.discountKind : null,
        discount_value: inv.discountValue,
        total_cents: inv.totalCents,
        notes: inv.notes || null,
        due_date: inv.dueDate,
        project_id: inv.projectId,
        project_ids: inv.projectIds.length ? inv.projectIds : inv.projectId ? [inv.projectId] : [],
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Could not update the invoice." }, { status: 500 });
    }
  } else if (action === "sent") {
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
