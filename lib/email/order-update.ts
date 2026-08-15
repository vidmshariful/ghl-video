import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import { loadTemplate } from "./notify";
import { SITE_URL, escapeHtml, renderTemplate, wrapEmail } from "./templates";

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
      title: `New update on ${o.products?.name ?? "your project"}`,
      body: updateMessage.length > 120 ? `${updateMessage.slice(0, 117)}...` : updateMessage,
      href: `orders/${orderId}`,
    });

    const tpl = await loadTemplate(db, "order_update");
    if (!tpl || !tpl.enabled) return false;

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

    const result = await sendEmail({
      to: o.customer_email,
      toName: o.customers?.name ?? null,
      subject: renderTemplate(tpl.subject, vars),
      html: wrapEmail(renderTemplate(tpl.body, vars)),
    });
    if (!result.ok) console.error("[email] order update not sent:", result.error);

    // project progress also reaches team members who can see orders
    const { teamRecipients } = await import("@/lib/account-team");
    const team = (
      await teamRecipients(db, "customer", o.customer_email as string, "orders")
    ).filter((e) => e !== (o.customer_email as string).toLowerCase());
    for (const memberEmail of team) {
      const memberVars = { ...vars, customer_name: escapeHtml("there") };
      await sendEmail({
        to: memberEmail,
        toName: null,
        subject: renderTemplate(tpl.subject, memberVars),
        html: wrapEmail(renderTemplate(tpl.body, memberVars)),
      }).catch(() => {});
    }
    return result.ok;
  } catch (e) {
    console.error("[email] order update send failed", e instanceof Error ? e.message : e);
    return false;
  }
}
