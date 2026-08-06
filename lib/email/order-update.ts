import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import { DEFAULT_TEMPLATES, SITE_URL, escapeHtml, renderTemplate } from "./templates";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STAGE_LABELS: Record<string, string> = {
  paid: "Paid",
  intake: "Awaiting your details",
  production: "In production",
  review: "In review",
  delivered: "Delivered",
};

async function loadTemplate(db: SupabaseClient, key: string) {
  const { data } = await db
    .from("email_templates")
    .select("subject,body,enabled")
    .eq("key", key)
    .maybeSingle();
  if (data) return data as { subject: string; body: string; enabled: boolean };
  const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
  return def ? { subject: def.subject, body: def.body, enabled: true } : null;
}

/*
 * Email the client the order-update template for one order. Fail-soft: any
 * problem (template disabled, no customer email, send error) is logged and
 * returns false, so the caller (posting an order update) never breaks.
 */
export async function sendOrderUpdateEmail(
  db: SupabaseClient,
  orderId: string,
  updateMessage: string,
): Promise<boolean> {
  try {
    const tpl = await loadTemplate(db, "order_update");
    if (!tpl || !tpl.enabled) return false;

    const { data: order } = await db
      .from("orders")
      .select(
        "customer_email, fulfillment_stage, delivery_url, customers(name), products(name, sku, metadata)",
      )
      .eq("id", orderId)
      .maybeSingle();
    const o = order as any;
    if (!o?.customer_email) return false;

    const code = o.products?.metadata?.code ?? o.products?.sku?.toUpperCase() ?? "";
    const vars: Record<string, string> = {
      customer_name: escapeHtml(o.customers?.name || "there"),
      product_name: escapeHtml(o.products?.name || "your order"),
      order_code: escapeHtml(code),
      update_message: escapeHtml(updateMessage).replace(/\n/g, "<br>"),
      stage: escapeHtml(STAGE_LABELS[o.fulfillment_stage ?? ""] ?? o.fulfillment_stage ?? ""),
      portal_url: `${SITE_URL}/portal`,
      delivery_url: escapeHtml(o.delivery_url || ""),
    };

    return await sendEmail({
      to: o.customer_email,
      toName: o.customers?.name ?? null,
      subject: renderTemplate(tpl.subject, vars),
      html: renderTemplate(tpl.body, vars),
    });
  } catch (e) {
    console.error("[email] order update send failed", e instanceof Error ? e.message : e);
    return false;
  }
}
