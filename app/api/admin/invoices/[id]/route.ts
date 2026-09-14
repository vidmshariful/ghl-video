import { NextResponse } from "next/server";
import { verifyAdminFor } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { parseInvoiceInput } from "@/lib/invoices";
import { nudgeInvoice } from "@/lib/highlevel/nudge";

export const runtime = "nodejs";

/*
 * Invoice actions. "sent" stamps sent_at and HighLevel sends it (the sync
 * carries the stamp across; HighLevel's own email holds the pay link).
 * "void" closes it here and in HighLevel. A legacy invoice, one still
 * billed through a product, keeps its old behaviour: our email, and the
 * product switched off so the checkout link stops working.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminFor(req, "invoices");
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
      .select("id, status, product_id, paid_at, source")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.status === "void") {
      return NextResponse.json({ error: "This invoice is void. Raise a new one." }, { status: 400 });
    }
    if (existing.paid_at) {
      return NextResponse.json({ error: "This invoice is paid. It cannot be changed." }, { status: 400 });
    }
    if (existing.source === "highlevel") {
      return NextResponse.json({ error: "This invoice was made in HighLevel. Edit it there." }, { status: 400 });
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Could not update the invoice." }, { status: 500 });
    }
    if (!existing.product_id) await nudgeInvoice(db, id);
  } else if (action === "sent") {
    const { data: inv } = await db
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id)
      .select("product_id")
      .single();
    if (inv?.product_id) {
      /* legacy: the link goes to the client with the invoice itself, so nobody
         pastes it into a message by hand. Fail-soft: the stamp already stands. */
      try {
        const { sendInvoiceSentEmail } = await import("@/lib/email/notify");
        await sendInvoiceSentEmail(db, id);
      } catch (e) {
        console.error("[invoice] sent email failed:", e instanceof Error ? e.message : e);
      }
    } else {
      /* HighLevel sends it, with its pay link */
      await nudgeInvoice(db, id);
    }
  } else if (action === "void") {
    /*
     * A paid invoice is a record of money that moved, not a document to
     * cancel. Voiding it here left our row void with its paid mark still on
     * it and HighLevel's copy paid, and the nightly check shouting about
     * both (audit, 15 September 2026). Money that has to go back is a refund.
     */
    const { data: existing } = await db.from("invoices").select("id, paid_at").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.paid_at) {
      return NextResponse.json(
        { error: "This invoice is paid. It cannot be voided; refund the payment in HighLevel instead." },
        { status: 400 },
      );
    }
    const { data: inv } = await db
      .from("invoices")
      .update({ status: "void", updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("paid_at", null)
      .select("product_id")
      .maybeSingle();
    /* paid between the read above and this write: the same answer */
    if (!inv) return NextResponse.json({ error: "This invoice was just paid. It cannot be voided." }, { status: 400 });
    if (inv.product_id) {
      await db.from("products").update({ active: false }).eq("id", inv.product_id);
    } else {
      await nudgeInvoice(db, id);
    }
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
