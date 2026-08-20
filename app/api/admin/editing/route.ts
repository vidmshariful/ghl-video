import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { currentCycle, planNameFor, planPriority } from "@/lib/subscription-cycles";
import { queueOrder, slotsUsed } from "@/lib/subscription-slots";
import { columnFor, qcPassed, type Qc } from "@/lib/editing-sop";
import { DELIVERABLE_STATUSES, type DeliverableStatus } from "@/lib/deliverable-status";

export const runtime = "nodejs";

/*
 * Editing plan work, for the studio.
 *
 * This is production, not billing. It lives under Production -> Editing
 * because a video request is work, and work belongs on a board with the rest
 * of the work. Subscriptions keeps the money.
 *
 * Two shapes from one route: with no query it is the client list (who is on
 * a plan, what they are owed this month, how much of it needs us), and with
 * ?subscription=<id> it is that client's board.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUB_FIELDS =
  "id, customer_email, plan_name, status, amount_cents, current_period_end, metadata, product:products(sku, name), customer:customers(name, company)";

/* what currentCycle needs, built explicitly rather than spread: the sku can
 * come from the joined product or the metadata, so it is resolved here once */
function cycleArgs(sub: Row) {
  return {
    id: String(sub.id),
    current_period_end: (sub.current_period_end as string | null) ?? null,
    product: { sku: skuOf(sub) },
  };
}

function skuOf(sub: Row): string | null {
  return (
    ((sub.product as { sku?: string } | null)?.sku ??
      (sub.metadata as { sku?: string } | null)?.sku) ||
    null
  );
}

function shape(d: Row) {
  const qc = (d.qc as Qc | null) ?? {};
  return {
    id: String(d.id),
    parentId: (d.parent_id as string | null) ?? null,
    title: String(d.title),
    brief: (d.note as string | null) ?? null,
    status: String(d.status),
    form: (d.form as "long" | "short" | null) ?? null,
    aspect: (d.aspect as string | null) ?? null,
    targetSeconds: (d.target_seconds as number | null) ?? null,
    assetsUrl: (d.assets_url as string | null) ?? null,
    referenceUrl: (d.reference_url as string | null) ?? null,
    assetsReadyAt: (d.assets_ready_at as string | null) ?? null,
    requestedDueAt: (d.requested_due_at as string | null) ?? null,
    dueAt: (d.due_at as string | null) ?? null,
    assignedTo: (d.assigned_admin_email as string | null) ?? null,
    videoUrl: (d.video_url as string | null) ?? null,
    revisionRound: Number(d.revision_round ?? 0),
    cancelledAt: (d.cancelled_at as string | null) ?? null,
    cancelledReason: (d.cancelled_reason as string | null) ?? null,
    createdAt: String(d.created_at),
    qc,
    qcPassed: qcPassed(qc),
    column: columnFor({
      status: String(d.status),
      assetsReadyAt: (d.assets_ready_at as string | null) ?? null,
    }),
  };
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const wanted = new URL(req.url).searchParams.get("subscription");

  /* ---------- one client's board ---------- */
  if (wanted) {
    if (!UUID_RE.test(wanted))
      return NextResponse.json({ error: "Which client?" }, { status: 400 });

    const { data: sub } = await db.from("subscriptions").select(SUB_FIELDS).eq("id", wanted).maybeSingle();
    if (!sub) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const sku = skuOf(sub as Row);
    const cycle = await currentCycle(db, cycleArgs(sub as Row));

    /* every request on this plan, not only this month: work that ran long
       is still work, and hiding it at the month boundary loses it */
    const { data: months } = await db
      .from("subscription_cycles")
      .select("id, period_start, period_end")
      .eq("subscription_id", wanted)
      .order("period_start", { ascending: false });

    const monthIds = ((months ?? []) as Row[]).map((m) => String(m.id));
    const { data: rows } = monthIds.length
      ? await db
          .from("order_deliverables")
          .select("*")
          .in("cycle_id", monthIds)
          .order("created_at", { ascending: true })
      : { data: [] };

    const all = ((rows ?? []) as Row[]).map((d) => ({
      ...shape(d),
      cycleId: String(d.cycle_id),
    }));

    const thisMonth = cycle ? all.filter((r) => r.cycleId === cycle.id) : [];
    const use = slotsUsed(thisMonth, {
      longForm: cycle?.longFormAllowed ?? 0,
      shortForm: cycle?.shortFormAllowed ?? 0,
    });

    const { data: guide } = await db
      .from("editing_style_guides")
      .select("*")
      .eq("customer_email", String(sub.customer_email).toLowerCase())
      .maybeSingle();

    /* who can be put on a job */
    const { data: team } = await db.from("admins").select("email, name, role");

    return NextResponse.json({
      client: {
        subscriptionId: String(sub.id),
        email: String(sub.customer_email),
        name: (sub.customer as { name?: string } | null)?.name ?? null,
        company: (sub.customer as { company?: string } | null)?.company ?? null,
        planName: (sub.plan_name as string | null) ?? planNameFor(sku),
        sku,
        status: String(sub.status),
        renewsAt: (sub.current_period_end as string | null) ?? null,
        priority: planPriority(sku),
      },
      month: cycle
        ? { id: cycle.id, startsAt: cycle.periodStart, endsAt: cycle.periodEnd }
        : null,
      slots: use,
      requests: all,
      styleGuide: guide ?? null,
      team: ((team ?? []) as Row[]).map((t) => ({
        email: String(t.email),
        name: (t.name as string | null) ?? String(t.email),
      })),
    });
  }

  /* ---------- the client list ---------- */
  const { data: subs } = await db
    .from("subscriptions")
    .select(SUB_FIELDS)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false });

  const clients = [];
  for (const sub of (subs ?? []) as Row[]) {
    const sku = skuOf(sub);
    const cycle = await currentCycle(db, cycleArgs(sub));
    const { data: rows } = cycle
      ? await db
          .from("order_deliverables")
          .select("form, status, assets_ready_at, requested_due_at, cancelled_at, created_at")
          .eq("cycle_id", cycle.id)
      : { data: [] };

    const items = (rows ?? []) as Row[];
    const live = items.filter((r) => !r.cancelled_at);
    const use = slotsUsed(
      items.map((r) => ({
        form: r.form as "long" | "short" | null,
        cancelledAt: (r.cancelled_at as string | null) ?? null,
      })),
      { longForm: cycle?.longFormAllowed ?? 0, shortForm: cycle?.shortFormAllowed ?? 0 },
    );

    clients.push({
      subscriptionId: String(sub.id),
      email: String(sub.customer_email),
      name: (sub.customer as { name?: string } | null)?.name ?? null,
      company: (sub.customer as { company?: string } | null)?.company ?? null,
      planName: (sub.plan_name as string | null) ?? planNameFor(sku),
      sku,
      status: String(sub.status),
      renewsAt: (sub.current_period_end as string | null) ?? null,
      priority: planPriority(sku),
      slots: use,
      /* the number somebody scans this list for */
      needsUs: live.filter((r) => r.status === "queued" || r.status === "revisions").length,
      waitingOnThem: live.filter((r) => r.status === "queued" && !r.assets_ready_at).length,
      inProgress: live.filter((r) => r.status === "in_production").length,
      withClient: live.filter((r) => r.status === "ready").length,
      /* where this client sits in the studio's order today */
      nextUp: live
        .map((r) => ({
          planPriority: planPriority(sku),
          assetsReadyAt: (r.assets_ready_at as string | null) ?? null,
          requestedDueAt: (r.requested_due_at as string | null) ?? null,
          createdAt: String(r.created_at),
        }))
        .sort(queueOrder)[0] ?? null,
    });
  }

  clients.sort((a, b) => a.priority - b.priority || b.needsUs - a.needsUs);
  return NextResponse.json({ clients });
}

/*
 * Move one request along.
 *
 * Everything the studio does to a request goes through here: mark the
 * footage in (which starts the promise clock), name an editor, tick QC,
 * paste the cut, promise a date, move the status, or cancel it and hand the
 * slot back.
 */
export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Which request?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: before } = await db
    .from("order_deliverables")
    .select("id, status, qc, assets_ready_at, cycle_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!before.cycle_id)
    return NextResponse.json({ error: "That is not editing plan work." }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (DELIVERABLE_STATUSES.includes(b.status as DeliverableStatus)) {
    /*
     * A cut cannot reach a client until QC has run. This is the one place
     * the checklist is enforced rather than merely offered, because a
     * checklist nobody has to pass is decoration.
     */
    if (b.status === "ready" && !qcPassed((before.qc as Qc) ?? {})) {
      return NextResponse.json(
        { error: "Run the QC checks before this goes to the client." },
        { status: 400 },
      );
    }
    patch.status = b.status;
    if (b.status === "ready") patch.ready_at = new Date().toISOString();
    if (b.status === "approved") patch.approved_at = new Date().toISOString();
  }

  if ("dueAt" in b)
    patch.due_at = typeof b.dueAt === "string" && b.dueAt ? new Date(b.dueAt).toISOString() : null;

  if ("assetsReady" in b) {
    /* stamped once. Re-marking would restart a promise the client is
       already counting down, so an existing stamp is left alone. */
    patch.assets_ready_at = b.assetsReady
      ? ((before.assets_ready_at as string | null) ?? new Date().toISOString())
      : null;
  }

  if ("assignedTo" in b)
    patch.assigned_admin_email = typeof b.assignedTo === "string" && b.assignedTo ? b.assignedTo : null;

  if ("videoUrl" in b)
    patch.video_url = typeof b.videoUrl === "string" && b.videoUrl ? b.videoUrl.trim() : null;

  if ("assetsUrl" in b)
    patch.assets_url = typeof b.assetsUrl === "string" && b.assetsUrl ? b.assetsUrl.trim() : null;

  if (b.qc && typeof b.qc === "object")
    patch.qc = { ...((before.qc as Qc) ?? {}), ...(b.qc as Qc) };

  if ("cancel" in b) {
    patch.cancelled_at = b.cancel ? new Date().toISOString() : null;
    patch.cancelled_reason =
      b.cancel && typeof b.cancelledReason === "string" ? b.cancelledReason.slice(0, 400) : null;
  }

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { error } = await db.from("order_deliverables").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
