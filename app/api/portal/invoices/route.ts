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
      "id, number, token, product_sku, line_items, currency, total_cents, subtotal_cents, discount_kind, discount_value, status, due_date, notes, created_at, sent_at, parent_order_id, project_id, project_ids",
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

  /*
   * The jobs each invoice bills for, by name.
   *
   * The client can see the same list on the public invoice page. Having it
   * here too means the portal answers "what is this nine thousand for"
   * without them opening anything, which on an account with six projects
   * running is the whole question.
   */
  const allProjectIds = [
    ...new Set(rows.flatMap((r) => ((r.project_ids as string[] | null) ?? []).filter(Boolean))),
  ];
  const projectTitles = new Map<string, string>();
  if (allProjectIds.length) {
    const { data: projs } = await db.from("projects").select("id, title").in("id", allProjectIds);
    for (const pr of (projs ?? []) as Row[]) {
      projectTitles.set(String(pr.id), String(pr.title ?? "Project"));
    }
  }

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
        /*
         * `description` is the field invoices are actually written with.
         * This read `l.label`, which no invoice has ever had, so every line
         * on every client's screen fell through to the literal word "Item".
         * A nine thousand dollar bill described as "Item" is why this block
         * read like a table with a header and no data.
         */
        lineItems: Array.isArray(r.line_items)
          ? (
              r.line_items as {
                description?: string;
                amount_cents?: number;
                quantity?: number;
                unit_cents?: number;
              }[]
            ).map((l) => ({
              label: String(l.description ?? "").trim() || "Item",
              amountCents: Number(l.amount_cents ?? 0),
              /* carried so "6 x $1,500" can be said out loud rather than
                 collapsed into a total nobody can check */
              quantity: Number(l.quantity ?? 1),
              unitCents: Number(l.unit_cents ?? l.amount_cents ?? 0),
            }))
          : [],
        projects: ((r.project_ids as string[] | null) ?? [])
          .map((pid) => projectTitles.get(pid))
          .filter((t): t is string => Boolean(t)),
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
