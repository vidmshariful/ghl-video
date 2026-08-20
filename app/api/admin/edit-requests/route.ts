import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { DELIVERABLE_STATUSES, type DeliverableStatus } from "@/lib/deliverable-status";

export const runtime = "nodejs";

/*
 * Editing work asked for on a plan.
 *
 * These hang off a billing month rather than an order, so the production
 * board, which is built around orders, cannot see them. Until it is taught
 * to, this is the studio's queue for them: what was asked for, by whom, which
 * month it counts against, and the date the client hoped for.
 *
 * requested_due_at is the client's wish and due_at is our commitment. The
 * studio sets the second after reading the first; they are never the same
 * field, or we would be late against a date nobody agreed to.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: rows } = await db
    .from("order_deliverables")
    .select("id, cycle_id, title, note, status, form, due_at, requested_due_at, requested_at, created_at")
    .not("cycle_id", "is", null)
    .order("created_at", { ascending: false });

  const cycleIds = [...new Set(((rows ?? []) as Row[]).map((r) => String(r.cycle_id)))];
  const { data: cycles } = cycleIds.length
    ? await db
        .from("subscription_cycles")
        .select("id, subscription_id, period_start, period_end, long_form_allowed, short_form_allowed")
        .in("id", cycleIds)
    : { data: [] };

  const subIds = [...new Set(((cycles ?? []) as Row[]).map((c) => String(c.subscription_id)))];
  const { data: subs } = subIds.length
    ? await db
        .from("subscriptions")
        .select("id, customer_email, plan_name, product:products(name)")
        .in("id", subIds)
    : { data: [] };

  const cycleById = new Map(((cycles ?? []) as Row[]).map((c) => [String(c.id), c]));
  const subById = new Map(((subs ?? []) as Row[]).map((s) => [String(s.id), s]));

  return NextResponse.json({
    requests: ((rows ?? []) as Row[]).map((r) => {
      const cycle = cycleById.get(String(r.cycle_id));
      const sub = cycle ? subById.get(String(cycle.subscription_id)) : undefined;
      return {
        id: String(r.id),
        title: String(r.title),
        brief: (r.note as string | null) ?? null,
        status: String(r.status),
        form: (r.form as string | null) ?? null,
        dueAt: (r.due_at as string | null) ?? null,
        requestedDueAt: (r.requested_due_at as string | null) ?? null,
        requestedAt: (r.requested_at as string | null) ?? null,
        customerEmail: sub ? String(sub.customer_email) : null,
        planName: sub
          ? ((sub.plan_name as string | null) ??
            (sub.product as { name?: string } | null)?.name ??
            "Plan")
          : null,
        month: cycle
          ? { startsAt: String(cycle.period_start), endsAt: String(cycle.period_end) }
          : null,
      };
    }),
  });
}

/** Move one along, or commit to a date. */
export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Which request?" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (DELIVERABLE_STATUSES.includes(b.status as DeliverableStatus)) {
    patch.status = b.status;
    if (b.status === "ready") patch.ready_at = new Date().toISOString();
  }
  if ("dueAt" in b) {
    patch.due_at =
      typeof b.dueAt === "string" && b.dueAt ? new Date(b.dueAt).toISOString() : null;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("order_deliverables").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
