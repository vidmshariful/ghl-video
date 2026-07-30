import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureAuthAccount } from "@/lib/checkout/account";

export const runtime = "nodejs";

/*
 * Manual order entry: record a sale that happened OUTSIDE the site (a
 * HighLevel direct invoice, a wire, etc.) so the client gets portal access
 * and the studio gets the same fulfillment tracking as a native order.
 *
 * Reuses the existing customers/orders/fulfillment tables: upserts the
 * customer, provisions a portal account, and writes a paid order. No Stripe
 * and no HighLevel sync (the sale already lives there); the order is tagged
 * metadata.manual so the dashboard does not flag it as "not synced". A
 * catalog SKU associates the order with a real product; otherwise a custom
 * one_time product row is created to carry the title + price.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(body.name, 120);
  const email = str(body.email, 254).toLowerCase();
  const company = str(body.company, 120);
  const phone = str(body.phone, 32);
  const productSku = str(body.productSku, 64);
  const customTitle = str(body.customTitle, 160);
  const invoiceRef = str(body.invoiceRef, 60);
  const hlContactId = str(body.hlContactId, 64);
  const note = str(body.note, 2000);
  const amountCents = Math.round(Number(body.amountCents));

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid client email is required." }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Resolve the product: a catalog SKU, else a created custom row.
  let productId: string | null = null;
  let sku = "";
  if (productSku) {
    const { data: prod } = await db
      .from("products")
      .select("id, sku")
      .eq("sku", productSku)
      .maybeSingle();
    if (prod) {
      productId = prod.id as string;
      sku = prod.sku as string;
    }
  }
  if (!productId) {
    const csku = `manual-${Math.random().toString(36).slice(2, 8)}`;
    const { data: cp, error: cpErr } = await db
      .from("products")
      .insert({
        sku: csku,
        name: (customTitle || "Manual order").slice(0, 120),
        price_cents: amountCents,
        currency: "usd",
        type: "one_time",
        active: true,
        metadata: { manual: true },
      })
      .select("id, sku")
      .single();
    if (cpErr || !cp) {
      return NextResponse.json({ error: "Could not create the order." }, { status: 500 });
    }
    productId = cp.id as string;
    sku = cp.sku as string;
  }

  // Upsert the customer (admin entry is authoritative, so details merge in).
  const { data: customer, error: custErr } = await db
    .from("customers")
    .upsert(
      {
        email,
        name: name || null,
        company: company || null,
        phone: phone || null,
        ...(hlContactId ? { highlevel_contact_id: hlContactId } : {}),
      },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (custErr || !customer) {
    return NextResponse.json({ error: "Could not save the client." }, { status: 500 });
  }

  // Portal access (best-effort, never blocks).
  await ensureAuthAccount(email);

  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      product_id: productId,
      customer_id: customer.id,
      customer_email: email,
      amount_cents: amountCents,
      currency: "usd",
      status: "paid",
      paid_at: new Date().toISOString(),
      invoice_number: invoiceRef || null,
      highlevel_contact_id: hlContactId || null,
      fulfillment_stage: "paid",
      metadata: {
        manual: true,
        source: "external",
        sku,
        ...(invoiceRef ? { invoice_ref: invoiceRef } : {}),
        ...(note ? { note } : {}),
      },
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    if (orderErr?.code === "23505") {
      return NextResponse.json(
        { error: "That invoice reference is already recorded." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Could not create the order." }, { status: 500 });
  }

  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "manual_order",
    payload: { by: admin.email, source: "external", invoice_ref: invoiceRef || null },
  });

  return NextResponse.json({ orderId: order.id });
}
