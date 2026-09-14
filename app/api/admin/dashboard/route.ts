import { NextResponse } from "next/server";
import { adminRole, verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { invoiceOpen, invoiceSettled } from "@/lib/invoice-state";
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
 * the money is doing, and what the work is doing. The money layer is left
 * out for a Sales Rep: their menu never offers the sales screen, and the
 * dashboard must not hand them company revenue by another door.
 *
 * The 30-day figure follows the sales screen's definition (app/api/admin/
 * sales): a one-time sale is dated by when it was PAID, and the recurring
 * charges in subscription_payments count too. The two screens used to
 * answer "this month" differently, which is how they came to disagree.
 */

type Row = Record<string, unknown>;

const cents = (v: unknown) => Number(v ?? 0);

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const showMoney = (await adminRole(admin.email)) !== "sales_rep";

  const db = supabaseAdmin();
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const monthAgo = new Date(now - 30 * 86_400_000).toISOString();
  const weekAhead = new Date(now + 7 * 86_400_000).toISOString();

  const [
    orders,
    recent,
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
    recurring,
  ] = await Promise.all([
    /*
     * Every order, but only the columns the arithmetic needs, and no joins.
     * This used to drag the product and customer names of every order that
     * has ever existed across the wire to add up six numbers and show six
     * rows. The six rows are fetched separately below, with their joins, and
     * a limit.
     *
     * products(sku) is here because the invoice check reads it. It used to
     * select products(name) and read .sku, which is always undefined, so the
     * set of paid skus was a set containing one empty string and no settled
     * invoice was ever excluded from what we are owed. On today's data that
     * had the dashboard claiming 9,550 owed against a real 9,000.
     */
    db
      .from("orders")
      .select("customer_email, amount_cents, status, created_at, paid_at, intake_completed, product:products(sku, metadata)")
      .order("created_at", { ascending: false }),
    /* the six the dashboard actually lists, with the names it shows */
    db
      .from("orders")
      .select(
        "id, customer_email, amount_cents, currency, status, created_at, product:products(name), customer:customers(name)",
      )
      .order("created_at", { ascending: false })
      .limit(6),
    db.from("subscriptions").select("customer_email, status, amount_cents, plan_name"),
    db.from("invoices").select("id, number, customer_email, total_cents, status, product_sku, product_id, due_date, paid_at, hl_status, amount_paid_cents"),
    db.from("projects").select("id, title, status, due_at, pipeline, customer_email, agreed_cents, quoted_cents"),
    /* with whoever owns each video (an order, a custom project, or an
       editing month), so the studio's own account can be left out below */
    db
      .from("order_deliverables")
      .select(
        "id, title, status, due_at, ready_at, project_id, cycle_id, order_id, order:orders(customer_email), project:projects(customer_email), cycle:subscription_cycles(subscription:subscriptions(customer_email))",
      )
      .neq("status", "approved"),
    db.from("customers").select("id, email, created_at, internal"),
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
    /* every recurring charge that actually succeeded */
    db.from("subscription_payments").select("amount_cents, paid_at, customer_email"),
  ]);

  /*
   * The studio's own accounts (the demo client) are not customers. They are
   * out of every money figure and every studio count, the way the customer
   * list and the sweep already leave them out. Filtered at the source, so
   * nothing below has to remember.
   */
  const allCustomers = (customers.data ?? []) as Row[];
  const internal = new Set(
    allCustomers.filter((c) => c.internal).map((c) => String(c.email).toLowerCase()),
  );
  const isInternal = (email: unknown) => internal.has(String(email ?? "").toLowerCase());
  const external = (rows: Row[] | null) => ((rows ?? []) as Row[]).filter((r) => !isInternal(r.customer_email));
  /* a video belongs to an order, a custom project, or an editing month */
  const deliverableEmail = (d: Row) => {
    const order = d.order as { customer_email?: string } | null;
    const project = d.project as { customer_email?: string } | null;
    const cycle = d.cycle as { subscription?: { customer_email?: string } | null } | null;
    return order?.customer_email ?? project?.customer_email ?? cycle?.subscription?.customer_email ?? "";
  };

  const orderRows = external(orders.data as Row[] | null);
  const paid = orderRows.filter((o) => String(o.status) === "paid");
  /* dated by payment, like the sales screen: an order raised in March and
     paid in April is April's revenue */
  const paidOn = (o: Row) => String(o.paid_at ?? o.created_at);
  const projectRows = external(projects.data as Row[] | null);
  const openProjects = projectRows.filter((p) => isOpen(normalizeProjectStatus(String(p.status))));
  const delivRows = ((deliverables.data ?? []) as Row[]).filter((d) => !isInternal(deliverableEmail(d)));
  const invoiceRows = external(invoices.data as Row[] | null);
  const subRows = external(subs.data as Row[] | null);
  const recurringRows = external(recurring.data as Row[] | null);

  /* ---- money ---- */
  /* invoices paid in HighLevel have no order behind them, so they are added
     from the invoice itself; a legacy one paid through checkout has an order
     and is already in `paid` */
  const hlPaid = invoiceRows.filter((i) => !i.product_id && invoiceSettled(i));
  const hlPaidCents = (i: Row) => cents(i.amount_paid_cents || i.total_cents);
  const recurringCents = (rows: Row[]) => rows.reduce((s, x) => s + cents(x.amount_cents), 0);
  const allTimeCents =
    paid.reduce((s, o) => s + cents(o.amount_cents), 0) +
    hlPaid.reduce((s, i) => s + hlPaidCents(i), 0) +
    recurringCents(recurringRows);
  const monthCents =
    paid.filter((o) => paidOn(o) >= monthAgo).reduce((s, o) => s + cents(o.amount_cents), 0) +
    hlPaid.filter((i) => String(i.paid_at) >= monthAgo).reduce((s, i) => s + hlPaidCents(i), 0) +
    recurringCents(recurringRows.filter((x) => String(x.paid_at) >= monthAgo));

  const BILLING = new Set(["active", "trialing", "past_due"]);
  const mrrCents = subRows
    .filter((s) => BILLING.has(String(s.status)))
    .reduce((s, x) => s + cents(x.amount_cents), 0);

  const openInvoices = invoiceRows.filter((i) => invoiceOpen(i));
  const owedCents = openInvoices.reduce((s, i) => s + Math.max(0, cents(i.total_cents) - cents(i.amount_paid_cents)), 0);
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
    const slot = days.find((d) => d.key === new Date(paidOn(o)).toDateString());
    if (slot) slot.cents += cents(o.amount_cents);
  }
  for (const i of hlPaid) {
    const slot = days.find((d) => d.key === new Date(String(i.paid_at)).toDateString());
    if (slot) slot.cents += hlPaidCents(i);
  }
  for (const x of recurringRows) {
    const slot = days.find((d) => d.key === new Date(String(x.paid_at)).toDateString());
    if (slot) slot.cents += cents(x.amount_cents);
  }

  /* ---- what needs a person today ---- */
  const withClient = delivRows.filter((d) => String(d.status) === "ready");
  const projectsWithClient = openProjects.filter(
    (p) => ballInCourt(normalizePipeline(p.pipeline)) === "client",
  );
  /* an invoice payment has no brief to wait for */
  const noBrief = paid.filter(
    (o) =>
      o.intake_completed === false &&
      !((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata?.invoice),
  );
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

  const custRows = allCustomers.filter((c) => !c.internal);

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
    ...(showMoney
      ? {
          money: {
            allTimeCents,
            monthCents,
            mrrCents,
            owedCents,
            pipelineCents,
            openInvoices: openInvoices.length,
            liveSubscriptions: subRows.filter((s) => BILLING.has(String(s.status))).length,
          },
          days,
        }
      : {}),
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
    paidOrders: paid.length,
    recentOrders: ((recent.data ?? []) as Row[]).map((o) => ({
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
