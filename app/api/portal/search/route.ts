import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { isWatchable, STATUS_LABEL, type DeliverableStatus } from "@/lib/deliverable-status";
import { CLIENT_LABEL, type ProjectStatus } from "@/lib/projects";

export const runtime = "nodejs";

/*
 * One search across everything a client has with us.
 *
 * The portal grew into eleven screens. Finding a specific thing meant knowing
 * which screen it was filed under, which is a question about how we built the
 * product rather than about their video, and it gets worse every month: the
 * subscription exists to produce fifty videos a year.
 *
 * It searches what they OWN and what they could BUY, because both are answers
 * to "where is the thing I am thinking of". A result carries where it lives,
 * so the browser never has to work that out.
 *
 * Everything is scoped to the acting account and gated on the same features
 * the screens are, so search can never become the way around a permission.
 */

type Row = Record<string, unknown>;

export type Hit = {
  id: string;
  kind: "video" | "order" | "project" | "invoice" | "library" | "message";
  title: string;
  meta: string;
  /* where it opens: a portal section, plus the thing to focus inside it */
  section: string;
  focus?: string;
  line?: "premade" | "custom" | "editing";
};

const LIMIT_PER_KIND = 6;
const matches = (term: string, ...fields: (string | null | undefined)[]) =>
  fields.filter(Boolean).some((f) => String(f).toLowerCase().includes(term));

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ hits: [] });

  const term = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  /* two characters is where a search stops being everything */
  if (term.length < 2) return NextResponse.json({ hits: [] });

  const email = ctx.ownerEmail;
  const hits: Hit[] = [];

  const canOrders = contextCan(ctx, "orders");
  const canPlans = contextCan(ctx, "subscriptions");

  /* ---- what they own ---- */
  if (canOrders || canPlans) {
    const { data: orders } = canOrders
      ? await db
          .from("orders")
          .select("id, invoice_number, created_at, product:products(name, sku)")
          .ilike("customer_email", email)
          .eq("status", "paid")
      : { data: [] };

    const { data: projects } = canOrders
      ? await db
          .from("projects")
          .select("id, title, status")
          .ilike("customer_email", email)
          .neq("status", "cancelled")
      : { data: [] };

    const { data: subs } = canPlans
      ? await db.from("subscriptions").select("id").ilike("customer_email", email)
      : { data: [] };
    const { data: cycles } = (subs ?? []).length
      ? await db
          .from("subscription_cycles")
          .select("id")
          .in("subscription_id", ((subs ?? []) as Row[]).map((s) => String(s.id)))
      : { data: [] };

    const orderIds = ((orders ?? []) as Row[]).map((o) => String(o.id));
    const projectIds = ((projects ?? []) as Row[]).map((p) => String(p.id));
    const cycleIds = ((cycles ?? []) as Row[]).map((c) => String(c.id));

    /* every video they own, whichever of the three owners it hangs off */
    const owners: [string, string[]][] = [
      ["order_id", orderIds],
      ["project_id", projectIds],
      ["cycle_id", cycleIds],
    ];
    for (const [col, ids] of owners) {
      if (!ids.length) continue;
      const { data } = await db
        .from("order_deliverables")
        .select("id, title, status, catalog_code, category, group_label, form, cancelled_at")
        .in(col, ids);
      for (const v of (data ?? []) as Row[]) {
        if (v.cancelled_at) continue;
        if (!matches(term, v.title as string, v.catalog_code as string, v.category as string, v.group_label as string))
          continue;
        const line = col === "order_id" ? "premade" : col === "project_id" ? "custom" : "editing";
        const status = v.status as DeliverableStatus;
        hits.push({
          id: String(v.id),
          kind: "video",
          title: String(v.title),
          meta: `${line === "premade" ? "Pre-made" : line === "custom" ? "Custom" : "Editing"} / ${STATUS_LABEL[status] ?? status}${isWatchable(status) ? "" : ", not ready yet"}`,
          section: line === "custom" ? "projects" : line === "editing" ? "subscriptions" : "videos",
          focus: String(v.id),
          line: line as Hit["line"],
        });
      }
    }

    for (const o of (orders ?? []) as Row[]) {
      const p = o.product as { name?: string; sku?: string } | null;
      if (!matches(term, p?.name, p?.sku, o.invoice_number as string)) continue;
      hits.push({
        id: String(o.id),
        kind: "order",
        title: p?.name ?? "Order",
        meta: `Order${o.invoice_number ? ` / ${o.invoice_number}` : ""}`,
        section: "orders",
        focus: String(o.id),
      });
    }

    for (const p of (projects ?? []) as Row[]) {
      if (!matches(term, p.title as string)) continue;
      hits.push({
        id: String(p.id),
        kind: "project",
        title: String(p.title),
        meta: `Custom project / ${CLIENT_LABEL[p.status as ProjectStatus] ?? p.status}`,
        section: "projects",
      });
    }

    const { data: invoices } = canOrders
      ? await db
          .from("invoices")
          .select("id, number, line_items, total_cents, status")
          .ilike("customer_email", email)
      : { data: [] };
    for (const i of (invoices ?? []) as Row[]) {
      const label = Array.isArray(i.line_items)
        ? String((i.line_items as { label?: string }[])[0]?.label ?? "Invoice")
        : "Invoice";
      if (!matches(term, i.number as string, label)) continue;
      hits.push({
        id: String(i.id),
        kind: "invoice",
        title: label,
        meta: `Invoice ${i.number ?? ""}`.trim(),
        section: "orders",
      });
    }
  }

  /* ---- what they could buy ---- */
  if (canOrders) {
    const [{ data: catalog }, { data: products }] = await Promise.all([
      db
        .from("catalog")
        .select("code, title, subject, category, kind, on_site, coming_soon")
        .eq("on_site", true),
      db.from("products").select("sku, active"),
    ]);
    const sellable = new Set(
      ((products ?? []) as Row[]).filter((p) => p.active).map((p) => String(p.sku)),
    );
    for (const c of (catalog ?? []) as Row[]) {
      if (c.coming_soon) continue;
      if (!sellable.has(String(c.code).toLowerCase())) continue;
      if (!matches(term, c.title as string, c.code as string, c.subject as string, c.category as string))
        continue;
      hits.push({
        id: String(c.code),
        kind: "library",
        title: String(c.title),
        meta: `In the library / ${c.category ?? c.kind}`,
        section: "library",
        focus: String(c.code),
      });
    }
  }

  /* ---- what was said ---- */
  if (contextCan(ctx, "messages")) {
    const { data: convos } = await db
      .from("conversations")
      .select("id, last_message_preview, last_message_at, order_id")
      .ilike("customer_email", email);
    for (const c of (convos ?? []) as Row[]) {
      if (!matches(term, c.last_message_preview as string)) continue;
      hits.push({
        id: String(c.id),
        kind: "message",
        title: String(c.last_message_preview ?? "Message"),
        meta: "In your messages",
        section: "messages",
      });
    }
  }

  /*
   * Owned things first, then the shop, then chat.
   *
   * Somebody searching in their own portal is far more often looking for a
   * thing they have than a thing they could buy, and a search that leads with
   * what it wants to sell you reads as an advert.
   */
  const RANK: Record<Hit["kind"], number> = {
    video: 0,
    project: 1,
    order: 2,
    invoice: 3,
    library: 4,
    message: 5,
  };
  const seen = new Map<Hit["kind"], number>();
  const ordered = hits
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.title.localeCompare(b.title))
    .filter((h) => {
      const n = (seen.get(h.kind) ?? 0) + 1;
      seen.set(h.kind, n);
      return n <= LIMIT_PER_KIND;
    });

  return NextResponse.json({ hits: ordered, total: hits.length });
}
