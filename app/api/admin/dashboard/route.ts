import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { STUDIO_LABEL, isOpen, normalizeProjectStatus } from "@/lib/projects";
import { ballInCourt, normalizePipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Everything the dashboard shows, computed on the server in one call.
 *
 * It used to pull every order into the browser and add them up there, which
 * is fine at eleven orders and a problem at eleven hundred. More to the
 * point, the dashboard only ever showed money: the studio's actual state,
 * what is waiting on a client, what has no brief, what is late, lived on
 * five other screens and had to be hunted for.
 *
 * The shape is deliberately three layers: what needs a person today, what
 * the money is doing, and what the work is doing.
 */

type Row = Record<string, unknown>;

const cents = (v: unknown) => Number(v ?? 0);

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const monthAgo = new Date(now - 30 * 86_400_000).toISOString();
  const weekAhead = new Date(now + 7 * 86_400_000).toISOString();

  const [
    orders,
    subs,
    invoices,
    projects,
    deliverables,
    customers,
    enquiries,
    alarms,
    emailFails,
    conversations,
    feedback,
  ] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, customer_email, amount_cents, currency, status, created_at, intake_completed, product:products(name), customer:customers(name)",
      )
      .order("created_at", { ascending: false }),
    db.from("subscriptions").select("status, amount_cents, plan_name"),
    db.from("invoices").select("id, number, total_cents, status, product_sku, due_date"),
    db.from("projects").select("id, title, status, due_at, pipeline, customer_email, agreed_cents, quoted_cents"),
    db
      .from("order_deliverables")
      .select("id, title, status, due_at, ready_at, project_id, cycle_id, order_id")
      .neq("status", "approved"),
    db.from("customers").select("id, created_at"),
    db.from("project_requests").select("id, status"),
    db.from("alarms").select("id").is("resolved_at", null),
    db
      .from("email_log")
      .select("id")
      .eq("status", "failed")
      .gte("created_at", monthAgo),
    db.from("conversations").select("id, unread_admin"),
    db
      .from("video_feedback")
      .select("id, video_title, verdict, note, customer_email, created_at")
      .neq("verdict", "skipped")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const orderRows = (orders.data ?? []) as Row[];
  const paid = orderRows.filter((o) => String(o.status) === "paid");
  const projectRows = (projects.data ?? []) as Row[];
  const openProjects = projectRows.filter((p) => isOpen(normalizeProjectStatus(String(p.status))));
  const delivRows = (deliverables.data ?? []) as Row[];
  const invoiceRows = (invoices.data ?? []) as Row[];

  /* ---- money ---- */
  const allTimeCents = paid.reduce((s, o) => s + cents(o.amount_cents), 0);
  const monthCents = paid
    .filter((o) => String(o.created_at) >= monthAgo)
    .reduce((s, o) => s + cents(o.amount_cents), 0);

  const BILLING = new Set(["active", "trialing", "past_due"]);
  const subRows = (subs.data ?? []) as Row[];
  const mrrCents = subRows
    .filter((s) => BILLING.has(String(s.status)))
    .reduce((s, x) => s + cents(x.amount_cents), 0);

  /* an invoice is settled when a paid order exists for its backing product */
  const paidSkus = new Set(
    paid.map((o) => String((o.product as { sku?: unknown } | null)?.sku ?? "")),
  );
  const openInvoices = invoiceRows.filter(
    (i) => String(i.status) === "open" && !paidSkus.has(String(i.product_sku)),
  );
  const owedCents = openInvoices.reduce((s, i) => s + cents(i.total_cents), 0);
  /* agreed custom work with no money in yet */
  const pipelineCents = openProjects.reduce(
    (s, p) => s + cents(p.agreed_cents ?? p.quoted_cents),
    0,
  );

  /* ---- the day's chart, thirty days of paid revenue ---- */
  const days: { key: string; label: string; cents: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    days.push({
      key: d.toDateString(),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cents: 0,
    });
  }
  for (const o of paid) {
    const slot = days.find((d) => d.key === new Date(String(o.created_at)).toDateString());
    if (slot) slot.cents += cents(o.amount_cents);
  }

  /* ---- what needs a person today ---- */
  const withClient = delivRows.filter((d) => String(d.status) === "ready");
  const projectsWithClient = openProjects.filter(
    (p) => ballInCourt(normalizePipeline(p.pipeline)) === "client",
  );
  const noBrief = paid.filter((o) => o.intake_completed === false);
  const newEnquiries = ((enquiries.data ?? []) as Row[]).filter(
    (e) => String(e.status) === "new",
  );
  const unread = ((conversations.data ?? []) as Row[]).filter((c) => Number(c.unread_admin ?? 0) > 0);

  const lateProjects = openProjects.filter(
    (p) => p.due_at && String(p.due_at) < nowIso,
  );
  const lateVideos = delivRows.filter((d) => d.due_at && String(d.due_at) < nowIso);

  /* ---- what the work is doing ---- */
  const byStage: { key: string; label: string; count: number }[] = [];
  for (const p of openProjects) {
    const st = normalizeProjectStatus(String(p.status));
    const hit = byStage.find((x) => x.key === st);
    if (hit) hit.count += 1;
    else byStage.push({ key: st, label: STUDIO_LABEL[st] ?? st, count: 1 });
  }

  const dueSoon = [
    ...openProjects
      .filter((p) => p.due_at && String(p.due_at) >= nowIso && String(p.due_at) <= weekAhead)
      .map((p) => ({
        kind: "project" as const,
        id: String(p.id),
        title: String(p.title),
        who: String(p.customer_email),
        at: String(p.due_at),
      })),
    ...delivRows
      .filter((d) => d.due_at && String(d.due_at) >= nowIso && String(d.due_at) <= weekAhead)
      .map((d) => ({
        kind: "video" as const,
        id: String(d.id),
        title: String(d.title),
        who: "",
        at: String(d.due_at),
      })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 8);

  const custRows = (customers.data ?? []) as Row[];

  return NextResponse.json({
    needs: {
      withClient: withClient.length,
      projectsWithClient: projectsWithClient.length,
      noBrief: noBrief.length,
      newEnquiries: newEnquiries.length,
      unreadMessages: unread.length,
      alarms: (alarms.data ?? []).length,
      emailFails: (emailFails.data ?? []).length,
      lateProjects: lateProjects.length,
      lateVideos: lateVideos.length,
    },
    money: {
      allTimeCents,
      monthCents,
      mrrCents,
      owedCents,
      pipelineCents,
      openInvoices: openInvoices.length,
      liveSubscriptions: subRows.filter((s) => BILLING.has(String(s.status))).length,
    },
    work: {
      inProduction: delivRows.filter((d) => String(d.status) === "in_production").length,
      revisions: delivRows.filter((d) => String(d.status) === "revisions").length,
      queued: delivRows.filter((d) => String(d.status) === "queued").length,
      openProjects: openProjects.length,
      byStage: byStage.sort((a, b) => b.count - a.count),
      dueSoon,
    },
    people: {
      customers: custRows.length,
      newThisMonth: custRows.filter((c) => String(c.created_at) >= monthAgo).length,
    },
    days,
    paidOrders: paid.length,
    recentOrders: orderRows.slice(0, 6).map((o) => ({
      id: String(o.id),
      email: String(o.customer_email),
      name: (o.customer as { name?: string | null } | null)?.name ?? null,
      product: (o.product as { name?: string } | null)?.name ?? null,
      amountCents: cents(o.amount_cents),
      currency: String(o.currency ?? "usd"),
      status: String(o.status),
      at: String(o.created_at),
    })),
    feedback: (feedback.data ?? []) as Row[],
  });
}
