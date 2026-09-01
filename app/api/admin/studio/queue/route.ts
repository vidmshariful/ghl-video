import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { describeDue } from "@/lib/delivery-dates";

export const runtime = "nodejs";

/*
 * Everything waiting on the studio, as a list of VIDEOS rather than orders.
 *
 * Every other admin screen is organised by order, which is how we sell but not
 * how we work. Four pack orders is thirty six videos, and finding the three
 * that need somebody meant opening four jobs and reading nine rows in each.
 * This answers "what do I do next" in one screen.
 *
 * Four buckets, in the order they should be dealt with:
 *   answer     a client note nobody has replied to or ticked off
 *   revisions  the client asked for changes and we have not finished them
 *   start      paid, brief in, nothing done yet
 *   waiting    with the client, and how long they have had it
 *
 * ALL THREE KINDS OF WORK
 *
 * This began at the orders table, so it only ever listed work somebody bought
 * outright. Custom projects and editing plans never appeared, which made the
 * one screen that answers "what do I do next" answer it for a third of the
 * work: eight items were invisible on it, six of them client notes nobody had
 * replied to. A queue you cannot trust to be complete is a queue you stop
 * opening.
 */

type Row = Record<string, unknown>;
type Kind = "purchase" | "project" | "plan";

const days = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();

  /* the three places work can hang off, and who each one belongs to */
  const [{ data: orders }, { data: projects }, { data: subs }] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, invoice_number, customer_email, intake_completed, intake_completed_at, assigned_admin_email, assigned_manager, customers(name), products(name)",
      )
      .eq("status", "paid")
      .neq("archived", true),
    db
      .from("projects")
      /* a LEFT join on purpose: an inner one drops any project whose client
         has no customers row, and a queue that silently loses work is worse
         than one that shows an email address instead of a name */
      .select("id, title, customer_email, owner_email, customers(name, slug)")
      .neq("status", "cancelled"),
    db
      .from("subscriptions")
      .select("id, plan_name, customer_email, customer:customers(name, slug)")
      .eq("status", "active"),
  ]);

  const orderIds = ((orders ?? []) as Row[]).map((o) => String(o.id));
  const projectIds = ((projects ?? []) as Row[]).map((p) => String(p.id));

  const { data: cycles } = subs?.length
    ? await db
        .from("subscription_cycles")
        .select("id, subscription_id")
        .in(
          "subscription_id",
          ((subs ?? []) as Row[]).map((s) => String(s.id)),
        )
    : { data: [] };
  const cycleIds = ((cycles ?? []) as Row[]).map((c) => String(c.id));

  if (!orderIds.length && !projectIds.length && !cycleIds.length)
    return NextResponse.json({ items: [], owners: [], me: admin.email });

  const FIELDS =
    "id, order_id, project_id, cycle_id, title, status, position, ready_at, updated_at, revision_round, video_url, due_at, category";

  /* one query per owner: an empty list stays an empty list, and the filter
     reads as the question it is asking */
  const [byOrder, byProject, byCycle] = await Promise.all(
    (
      [
        ["order_id", orderIds],
        ["project_id", projectIds],
        ["cycle_id", cycleIds],
      ] as const
    ).map(async ([col, ids]) => {
      if (!ids.length) return [] as Row[];
      const { data } = await db.from("order_deliverables").select(FIELDS).in(col, ids).order("position");
      return (data ?? []) as Row[];
    }),
  );
  const videos = [...byOrder, ...byProject, ...byCycle];
  if (!videos.length) return NextResponse.json({ items: [], owners: [], me: admin.email });

  /* every note on any of them, asked by video rather than by order: plan and
     project work has no order to ask through */
  const { data: notes } = await db
    .from("deliverable_comments")
    .select("id, deliverable_id, body, created_at, author_side, parent_id, resolved_at")
    .in(
      "deliverable_id",
      videos.map((v) => String(v.id)),
    );

  const ordersById = new Map(((orders ?? []) as Row[]).map((o) => [String(o.id), o]));
  const projectsById = new Map(((projects ?? []) as Row[]).map((p) => [String(p.id), p]));
  const subsById = new Map(((subs ?? []) as Row[]).map((s) => [String(s.id), s]));
  const subForCycle = new Map(
    ((cycles ?? []) as Row[]).map((c) => [String(c.id), String(c.subscription_id)]),
  );

  /* A client note counts as needing us until somebody replies to it or ticks
   * it off. Anything else and the queue would keep showing work already done. */
  const answered = new Set(
    ((notes ?? []) as Row[]).filter((n) => n.parent_id).map((n) => String(n.parent_id)),
  );
  const openByVideo = new Map<string, { body: string; at: string }[]>();
  for (const n of (notes ?? []) as Row[]) {
    if (n.parent_id || n.author_side !== "client" || n.resolved_at) continue;
    if (answered.has(String(n.id))) continue;
    const k = String(n.deliverable_id);
    openByVideo.set(k, [
      ...(openByVideo.get(k) ?? []),
      { body: String(n.body), at: String(n.created_at) },
    ]);
  }

  const items = videos
    .map((v) => {
      const open = openByVideo.get(String(v.id)) ?? [];
      const status = String(v.status);

      /* who this belongs to, what to call it, and where clicking it goes */
      let kind: Kind;
      let customer: string;
      let label: string;
      let ownerEmail: string | null = null;
      let ownerName: string | null = null;
      let orderId: string | null = null;
      let projectId: string | null = null;
      let editingSlug: string | null = null;
      let invoice: string | null = null;
      let briefLandedAt: string | null = null;
      let startable = false;

      if (v.order_id) {
        const o = ordersById.get(String(v.order_id));
        if (!o) return null;
        kind = "purchase";
        orderId = String(v.order_id);
        customer =
          (o.customers as { name?: string } | null)?.name ?? String(o.customer_email);
        label = (o.products as { name?: string } | null)?.name ?? "Order";
        ownerEmail = (o.assigned_admin_email as string | null) ?? null;
        ownerName = (o.assigned_manager as string | null) ?? null;
        invoice = (o.invoice_number as string | null) ?? null;
        briefLandedAt = (o.intake_completed_at as string | null) ?? null;
        startable = Boolean(o.intake_completed);
      } else if (v.project_id) {
        const p = projectsById.get(String(v.project_id));
        if (!p) return null;
        kind = "project";
        projectId = String(v.project_id);
        customer = (p.customers as { name?: string } | null)?.name ?? String(p.customer_email);
        label = String(p.title);
        ownerEmail = (p.owner_email as string | null) ?? null;
        /* a custom project's brief is its brief: there is no intake step to
           wait on, so queued work is startable the moment it exists */
        startable = true;
      } else if (v.cycle_id) {
        const s = subsById.get(subForCycle.get(String(v.cycle_id)) ?? "");
        if (!s) return null;
        kind = "plan";
        customer = (s.customer as { name?: string } | null)?.name ?? String(s.customer_email);
        editingSlug = (s.customer as { slug?: string } | null)?.slug ?? null;
        label = (s.plan_name as string | null) ?? "Editing plan";
        startable = true;
      } else {
        return null;
      }

      let bucket: "answer" | "revisions" | "start" | "waiting" | null = null;
      if (open.length) bucket = "answer";
      else if (status === "revisions") bucket = "revisions";
      else if (status === "queued" && startable) bucket = "start";
      else if (status === "ready") bucket = "waiting";
      if (!bucket) return null;

      return {
        bucket,
        kind,
        videoId: String(v.id),
        orderId,
        projectId,
        editingSlug,
        title: String(v.title),
        status,
        revisionRound: Number(v.revision_round ?? 0),
        hasLink: Boolean(v.video_url),
        openNotes: open.length,
        latestNote: open[open.length - 1]?.body?.slice(0, 120) ?? null,
        waitingDays: bucket === "waiting" ? days((v.ready_at as string | null) ?? null) : null,
        /* What the client was promised. Worded server-side so the board and
         * the client's own screen can never say different things about the
         * same video. */
        due: describeDue(
          { dueAt: (v.due_at as string | null) ?? null, status, briefLandedAt },
          Date.now(),
          "studio",
        ),
        sinceDays: days((v.updated_at as string | null) ?? null),
        customer,
        invoice,
        product: label,
        ownerEmail,
        ownerName,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const owners = [
    ...new Map(
      items
        .filter((i) => i.ownerEmail)
        .map((i) => [i.ownerEmail as string, i.ownerName ?? i.ownerEmail]),
    ).entries(),
  ].map(([email, name]) => ({ email, name }));

  return NextResponse.json({ items, owners, me: admin.email });
}
