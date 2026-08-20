import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { currentCycle, cycleHistory, planNameFor } from "@/lib/subscription-cycles";
import { describeSlots, overPlanWarning, slotsUsed, type Form } from "@/lib/subscription-slots";

export const runtime = "nodejs";

/*
 * An editing client's own plan: what it covers, what is left this month, and
 * what they have asked for.
 *
 * This is the screen that was empty. A subscription creates no order, so a
 * client paying every month had a portal showing them nothing at all while
 * we were editing for them.
 *
 * Slots are counted from the videos attached to the CURRENT cycle, so the
 * count resets on its own at renewal with nothing to run and nothing to
 * forget. Nothing rolls over, by decision.
 */

type Row = Record<string, unknown>;

async function planFor(db: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data } = await db
    .from("subscriptions")
    .select("id, status, amount_cents, currency, current_period_end, cancel_at_period_end, plan_name, created_at, product:products(sku, name)")
    .ilike("customer_email", email)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .maybeSingle();
  return data;
}

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ plan: null });
  if (!contextCan(ctx, "subscriptions")) return NextResponse.json({ plan: null });

  const sub = await planFor(db, ctx.ownerEmail);
  if (!sub) return NextResponse.json({ plan: null });

  const cycle = await currentCycle(db, sub as never);
  if (!cycle) return NextResponse.json({ plan: null });

  const { data: videos } = await db
    .from("order_deliverables")
    .select("id, title, status, form, note, due_at, requested_due_at, requested_at, video_url, created_at")
    .eq("cycle_id", cycle.id)
    .order("created_at", { ascending: false });

  const items = ((videos ?? []) as Row[]).map((v) => ({
    id: String(v.id),
    title: String(v.title),
    status: String(v.status),
    form: (v.form as Form | null) ?? null,
    brief: (v.note as string | null) ?? null,
    dueAt: (v.due_at as string | null) ?? null,
    requestedDueAt: (v.requested_due_at as string | null) ?? null,
    createdAt: String(v.created_at),
  }));

  const use = slotsUsed(items, {
    longForm: cycle.longFormAllowed,
    shortForm: cycle.shortFormAllowed,
  });

  const planName =
    (sub.plan_name as string | null) ??
    planNameFor((sub.product as { sku?: string } | null)?.sku ?? null);

  /* past months, so a client can see what they got for what they paid */
  const history = await cycleHistory(db, String(sub.id));
  const pastIds = history.filter((h) => h.id !== cycle.id).map((h) => h.id);
  const { data: pastVideos } = pastIds.length
    ? await db.from("order_deliverables").select("cycle_id, form").in("cycle_id", pastIds)
    : { data: [] };

  return NextResponse.json({
    plan: {
      planName,
      status: String(sub.status),
      amountCents: Number(sub.amount_cents ?? 0),
      renewsAt: (sub.current_period_end as string | null) ?? null,
      endingAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      cycle: {
        id: cycle.id,
        startsAt: cycle.periodStart,
        endsAt: cycle.periodEnd,
      },
      slots: { ...use, summary: describeSlots(use) },
      /* what they would be told if they asked for one more of each */
      warnings: {
        long: overPlanWarning(use, "long", planName),
        short: overPlanWarning(use, "short", planName),
      },
      videos: items,
      history: history
        .filter((h) => h.id !== cycle.id)
        .map((h) => {
          const mine = ((pastVideos ?? []) as Row[]).filter(
            (v) => String(v.cycle_id) === h.id,
          );
          return {
            id: h.id,
            startsAt: h.periodStart,
            endsAt: h.periodEnd,
            longUsed: mine.filter((v) => v.form === "long").length,
            shortUsed: mine.filter((v) => v.form === "short").length,
            longAllowed: h.longFormAllowed,
            shortAllowed: h.shortFormAllowed,
          };
        }),
    },
  });
}

/*
 * Ask for a video.
 *
 * Never refused, by decision. A client may request as much as they like and
 * the studio works through them one at a time against the plan; asking for
 * more than the month covers earns a warning and an upgrade offer, which the
 * screen shows before they submit and this route repeats in its answer.
 */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "subscriptions"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 160) : "";
  const brief = typeof b.brief === "string" ? b.brief.trim().slice(0, 4000) : "";
  const form: Form = b.form === "long" ? "long" : "short";
  const wantedBy =
    typeof b.requestedDueAt === "string" && b.requestedDueAt ? b.requestedDueAt : null;

  if (!title) return NextResponse.json({ error: "Give the video a name." }, { status: 400 });
  if (!brief)
    return NextResponse.json(
      { error: "Tell us what to edit, and where the footage is." },
      { status: 400 },
    );

  const sub = await planFor(db, ctx.ownerEmail);
  if (!sub) return NextResponse.json({ error: "You have no active plan." }, { status: 400 });
  const cycle = await currentCycle(db, sub as never);
  if (!cycle) return NextResponse.json({ error: "You have no active plan." }, { status: 400 });

  const { data: existing } = await db
    .from("order_deliverables")
    .select("id, form")
    .eq("cycle_id", cycle.id);
  const before = slotsUsed(((existing ?? []) as Row[]).map((v) => ({ form: v.form as Form | null })), {
    longForm: cycle.longFormAllowed,
    shortForm: cycle.shortFormAllowed,
  });

  const planName =
    (sub.plan_name as string | null) ??
    planNameFor((sub.product as { sku?: string } | null)?.sku ?? null);
  const warning = overPlanWarning(before, form, planName);

  const { error } = await db.from("order_deliverables").insert({
    cycle_id: cycle.id,
    title,
    note: brief,
    form,
    status: "queued",
    /* their ask, kept apart from due_at, which is what we commit to */
    requested_due_at: wantedBy,
    requested_at: new Date().toISOString(),
    position: (existing ?? []).length,
  });
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  const { pushAdminNotifications } = await import("@/lib/notifications");
  await pushAdminNotifications(db, {
    kind: "edit_requested",
    title: `Edit requested: ${title}`,
    body: `${ctx.ownerEmail}, ${form} form${wantedBy ? `, wants it by ${wantedBy.slice(0, 10)}` : ""}${warning ? ". Over their plan this month." : ""}`,
    href: "/admin/subscriptions/",
  });

  return NextResponse.json({ ok: true, warning });
}
