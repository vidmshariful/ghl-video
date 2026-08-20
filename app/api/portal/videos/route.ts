import { NextResponse } from "next/server";
import { describeDue } from "@/lib/delivery-dates";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import {
  canRequestChanges,
  canReview,
  isWatchable,
  REVISIONS_INCLUDED,
  type DeliverableStatus,
} from "@/lib/deliverable-status";

export const runtime = "nodejs";

/*
 * Every video the acting account has bought, grouped by the order it came in.
 *
 * An order with one video is a single video; an order with several is a pack.
 * The portal shows those as two tabs, so the grouping is decided here rather
 * than in the browser: the client should never have to work out which of their
 * purchases was a pack.
 *
 * The link is withheld until the video is genuinely watchable. Tanvir often
 * pastes a link while a video is still in production, and a client finding an
 * unfinished cut through the portal is exactly the accident this prevents.
 * order_deliverables is default-deny under RLS, so this runs on the service
 * role scoped to the owner's email, like the orders route.
 */
export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to orders." }, { status: 403 });
  const email = ctx.ownerEmail;

  const { data: orders } = await db
    .from("orders")
    .select("id, invoice_number, created_at, fulfillment_stage, intake_completed_at, product:products(name, sku, metadata)")
    .eq("customer_email", email)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o) => o.id as string);

  /*
   * Custom jobs belong in this list too.
   *
   * A client whose only work is a custom project has no orders at all, so
   * bailing out on an empty order list left their portal blank while we were
   * actively making something for them. Their job becomes a group here, which
   * means My Videos, the dashboard counts, review and approval all work for
   * them without any of it being written a second time.
   */
  const { data: projects } = await db
    .from("projects")
    .select("id, title, status, created_at, due_at")
    .ilike("customer_email", email)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  const projectIds = ((projects ?? []) as { id: string }[]).map((p) => p.id);

  /*
   * Editing plan work belongs in this list too, for the same reason custom
   * jobs do. A subscription creates no order, so a client whose only work is
   * a monthly plan had an empty My Videos while we were actively editing for
   * them. Each billing month becomes a group here, which means the counts,
   * review and approval all work for them without any of it being written a
   * second time.
   */
  const { data: subs } = await db
    .from("subscriptions")
    .select("id, plan_name")
    .ilike("customer_email", email);
  const subIds = ((subs ?? []) as { id: string }[]).map((s) => s.id);
  const { data: months } = subIds.length
    ? await db
        .from("subscription_cycles")
        .select("id, subscription_id, period_start, period_end")
        .in("subscription_id", subIds)
        .order("period_start", { ascending: false })
    : { data: [] };
  const monthIds = ((months ?? []) as { id: string }[]).map((m) => m.id);

  if (!ids.length && !projectIds.length && !monthIds.length)
    return NextResponse.json({ groups: [] });

  const { data: rows } = ids.length
    ? await db.from("order_deliverables").select("*").in("order_id", ids).order("position")
    : { data: [] };

  const { data: projectRows } = projectIds.length
    ? await db
        .from("order_deliverables")
        .select("*")
        .in("project_id", projectIds)
        .order("position")
    : { data: [] };

  const { data: monthRows } = monthIds.length
    ? await db
        .from("order_deliverables")
        .select("*")
        .in("cycle_id", monthIds)
        .is("cancelled_at", null)
        .order("created_at")
    : { data: [] };

  const byOrder = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const list = byOrder.get(r.order_id as string) ?? [];
    list.push(r);
    byOrder.set(r.order_id as string, list as typeof rows);
  }

  const groups = (orders ?? [])
    .map((o) => {
      const list = byOrder.get(o.id as string) ?? [];
      if (!list.length) return null;
      const product = o.product as unknown as {
        name: string;
        sku: string;
        metadata: { code?: string } | null;
      } | null;

      return {
        /* which service line this came from. The portal has a screen per
         * line, so the grouping is decided here rather than guessed in the
         * browser from a product code. */
        line: "premade" as const,
        orderId: o.id as string,
        invoiceNumber: o.invoice_number as string | null,
        orderedAt: o.created_at as string,
        productName: product?.name ?? "Your order",
        productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
        // one video is a video, several is a pack. The two portal tabs.
        kind: list.length > 1 ? ("pack" as const) : ("video" as const),
        videos: list.map((d) => {
          const status = d.status as DeliverableStatus;
          return {
            id: d.id as string,
            title: d.title as string,
            code: d.catalog_code as string | null,
            category: d.category as string | null,
            groupLabel: d.group_label as string | null,
            status,
            revisionRound: d.revision_round as number,
            // What this client may actually do, decided here rather than in
            // the browser so the buttons and the API can never disagree.
            canReview: canReview(status),
            canRequestChanges: canRequestChanges(status, d.revision_round as number),
            revisionsIncluded: REVISIONS_INCLUDED,
            revisionsUsed: d.revision_round as number,
            // withheld on purpose until it is ready to watch
            videoUrl: isWatchable(status) ? ((d.video_url as string | null) ?? null) : null,
            readyAt: d.ready_at as string | null,
            approvedAt: d.approved_at as string | null,
            /* The promised date, worded here rather than in the browser so
             * the client portal and the studio board can never describe the
             * same video differently. */
            due: describeDue(
              {
                dueAt: d.due_at as string | null,
                status,
                briefLandedAt: (o.intake_completed_at as string | null) ?? null,
              },
              Date.now(),
              "client",
            ),
          };
        }),
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  /* the same shape, so every screen downstream treats a job like an order */
  const projectGroups = ((projects ?? []) as Record<string, unknown>[])
    .map((p) => {
      const list = ((projectRows ?? []) as Record<string, unknown>[]).filter(
        (r) => String(r.project_id) === String(p.id),
      );
      if (!list.length) return null;
      return {
        line: "custom" as const,
        orderId: String(p.id),
        invoiceNumber: null,
        orderedAt: String(p.created_at),
        productName: String(p.title),
        productCode: "CUSTOM",
        kind: list.length > 1 ? ("pack" as const) : ("video" as const),
        videos: list.map((d) => {
          const status = d.status as DeliverableStatus;
          return {
            id: String(d.id),
            title: String(d.title),
            code: (d.catalog_code as string | null) ?? null,
            category: (d.category as string | null) ?? null,
            groupLabel: (d.group_label as string | null) ?? null,
            status,
            revisionRound: Number(d.revision_round),
            canReview: canReview(status),
            canRequestChanges: canRequestChanges(status, Number(d.revision_round)),
            revisionsIncluded: REVISIONS_INCLUDED,
            revisionsUsed: Number(d.revision_round),
            videoUrl: isWatchable(status) ? ((d.video_url as string | null) ?? null) : null,
            readyAt: (d.ready_at as string | null) ?? null,
            approvedAt: (d.approved_at as string | null) ?? null,
            due: describeDue(
              {
                dueAt: (d.due_at as string | null) ?? null,
                status,
                /* a custom job needs no brief before work starts: the brief
                 * was the conversation that sold it */
                briefLandedAt: String(p.created_at),
              },
              Date.now(),
              "client",
            ),
          };
        }),
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  /* one group per billing month, so a client sees "August" rather than a
     flat list that never ends */
  const planName = ((subs ?? []) as { plan_name?: string }[])[0]?.plan_name ?? "Editing";
  const monthGroups = ((months ?? []) as Record<string, unknown>[])
    .map((m) => {
      const list = ((monthRows ?? []) as Record<string, unknown>[]).filter(
        (r) => String(r.cycle_id) === String(m.id),
      );
      if (!list.length) return null;
      const label = new Date(String(m.period_start)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return {
        line: "editing" as const,
        orderId: String(m.id),
        invoiceNumber: null,
        orderedAt: String(m.period_start),
        productName: `${planName}, ${label}`,
        productCode: "EDITING",
        kind: list.length > 1 ? ("pack" as const) : ("video" as const),
        videos: list.map((d) => {
          const status = d.status as DeliverableStatus;
          return {
            id: String(d.id),
            title: String(d.title),
            code: null,
            category: (d.form as string | null) === "long" ? "Long form" : "Short form",
            groupLabel: null,
            status,
            revisionRound: Number(d.revision_round ?? 0),
            canReview: canReview(status),
            /* every editing tier sells unlimited revisions, so a plan client
               is never stopped at a round the page they bought from says
               does not exist */
            canRequestChanges: status !== "approved",
            revisionsIncluded: 0,
            revisionsUsed: Number(d.revision_round ?? 0),
            unlimitedRevisions: true,
            videoUrl: isWatchable(status) ? ((d.video_url as string | null) ?? null) : null,
            readyAt: (d.ready_at as string | null) ?? null,
            approvedAt: (d.approved_at as string | null) ?? null,
            due: describeDue(
              {
                dueAt: (d.due_at as string | null) ?? null,
                status,
                /* the clock starts when their footage lands, never when they
                   asked: that rule is the whole editing SOP in one field */
                briefLandedAt: (d.assets_ready_at as string | null) ?? null,
              },
              Date.now(),
              "client",
            ),
          };
        }),
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return NextResponse.json({ groups: [...groups, ...projectGroups, ...monthGroups] });
}
