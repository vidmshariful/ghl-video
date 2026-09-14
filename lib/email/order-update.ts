import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productLabel, sendTemplateToTeam } from "./notify";
import { SITE_URL, escapeHtml } from "./templates";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STAGE_LABELS: Record<string, string> = {
  paid: "Paid",
  intake: "Awaiting your details",
  production: "In production",
  review: "In review",
  delivered: "Delivered",
};

/*
 * Email the client the order-update template for one order. Fail-soft: any
 * problem (template disabled, no customer email, send error) is logged and
 * returns false, so the caller (posting an order update) never breaks.
 *
 * On the same rails as every other client email (sendTemplateToTeam): the
 * template key on the log row, the client's own preference gate, HighLevel
 * as the door, and the fan-out to teammates whose grants cover orders. This
 * file used to carry its own copy of the send with no template key, so the
 * email was routed to Brevo, the log row named no template, and a client who
 * had switched progress emails off got it anyway (audit, 15 September 2026).
 */
export async function sendOrderUpdateEmail(
  db: SupabaseClient,
  orderId: string,
  updateMessage: string,
): Promise<boolean> {
  try {
    const { data: order } = await db
      .from("orders")
      .select(
        "customer_email, fulfillment_stage, delivery_url, customers(name), products(name, sku, metadata)",
      )
      .eq("id", orderId)
      .maybeSingle();
    const o = order as any;
    if (!o?.customer_email) return false;

    // the in-portal bell rings even when the email template is switched off
    const { pushNotification } = await import("@/lib/notifications");
    await pushNotification(db, {
      audience: "customer",
      email: o.customer_email as string,
      kind: "order_update",
      title: `New update on ${productLabel(o.products)}`,
      body: updateMessage.length > 120 ? `${updateMessage.slice(0, 117)}...` : updateMessage,
      href: `orders/${orderId}`,
      vars: {
        product_name: productLabel(o.products),
        update_message: updateMessage.length > 120 ? `${updateMessage.slice(0, 117)}...` : updateMessage,
      },
    });

    const code = o.products?.metadata?.code ?? o.products?.sku?.toUpperCase() ?? "";
    const vars: Record<string, string> = {
      customer_name: escapeHtml(o.customers?.name || "there"),
      product_name: escapeHtml(productLabel(o.products)),
      order_code: escapeHtml(code),
      update_message: escapeHtml(updateMessage).replace(/\n/g, "<br>"),
      stage: escapeHtml(STAGE_LABELS[o.fulfillment_stage ?? ""] ?? o.fulfillment_stage ?? ""),
      /* the order the update is about, where the bell also points */
      portal_url: `${SITE_URL}/portal/orders/${orderId}/`,
      delivery_url: escapeHtml(o.delivery_url || ""),
    };

    return await sendTemplateToTeam(
      db,
      "order_update",
      { email: o.customer_email as string, name: (o.customers?.name as string | null) ?? null },
      vars,
      "orders",
    );
  } catch (e) {
    console.error("[email] order update send failed", e instanceof Error ? e.message : e);
    return false;
  }
}
