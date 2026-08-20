import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * The client's invoices, and specifically the ones they still owe.
 *
 * An invoice they have already paid is not news: paying it created an order,
 * and that order is what the Orders list has always shown. What was missing
 * is the other half. An OPEN invoice was visible to us and invisible to them,
 * so the only way a client learned they owed us something was an email they
 * may or may not still have.
 *
 * Money is never derived here. An invoice's total is what it says, and
 * whether it is settled is whether an order exists against it, which is the
 * same test the rest of the system uses.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const { data } = await db
    .from("invoices")
    .select(
      "id, number, token, product_sku, line_items, currency, total_cents, status, due_date, notes, created_at, sent_at, parent_order_id, project_id",
    )
    .ilike("customer_email", ctx.ownerEmail)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  /* an invoice is settled when a paid order exists for its throwaway sku:
   * the same test the admin invoice screen makes, so the two can never
   * disagree about whether somebody has paid */
  const skus = rows.map((r) => String(r.product_sku)).filter(Boolean);
  const { data: paidOrders } = skus.length
    ? await db
        .from("orders")
        .select("id, invoice_number, product:products!inner(sku)")
        .eq("customer_email", ctx.ownerEmail)
        .eq("status", "paid")
        .in("product.sku", skus)
    : { data: [] };

  const paidBySku = new Map(
    ((paidOrders ?? []) as Row[]).map((o) => [
      String((o.product as { sku?: string } | null)?.sku ?? ""),
      String(o.id),
    ]),
  );

  const now = Date.now();

  return NextResponse.json({
    invoices: rows.map((r) => {
      const orderId = paidBySku.get(String(r.product_sku)) ?? null;
      const settled = Boolean(orderId);
      const voided = String(r.status) === "void";
      const due = (r.due_date as string | null) ?? null;
      return {
        id: String(r.id),
        number: (r.number as string | null) ?? null,
        /* the public pay page, which is where they actually settle it */
        payUrl: !settled && !voided ? `/invoice/${String(r.token)}/` : null,
        lineItems: Array.isArray(r.line_items)
          ? (r.line_items as { label?: string; amount_cents?: number }[]).map((l) => ({
              label: String(l.label ?? "Item"),
              amountCents: Number(l.amount_cents ?? 0),
            }))
          : [],
        totalCents: Number(r.total_cents ?? 0),
        currency: String(r.currency ?? "usd"),
        notes: (r.notes as string | null) ?? null,
        dueDate: due,
        /* said plainly rather than left as a date to work out */
        overdue: Boolean(!settled && !voided && due && Date.parse(due) < now),
        settled,
        voided,
        orderId,
        createdAt: String(r.created_at),
        sentAt: (r.sent_at as string | null) ?? null,
      };
    }),
  });
}
