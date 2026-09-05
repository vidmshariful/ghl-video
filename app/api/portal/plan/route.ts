import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import {
  currentCycle,
  cycleHistory,
  planFeatures,
  planNameFor,
  topupCreditsLeft,
} from "@/lib/subscription-cycles";
import {
  creditsUsed,
  describeCredits,
  overPlanWarning,
} from "@/lib/subscription-slots";
import { ASPECTS, CLIENT_STATUS_WORD, columnFor, type Aspect } from "@/lib/editing-sop";
import { EDIT_TIERS, TOPUP_PACKS, creditCost, isPodcast, tierFor, type EditType, typeLabelFor } from "@/lib/editing-credits";

export const runtime = "nodejs";

/*
 * An editing client's plan, from their side.
 *
 * A subscription creates no order, and every video we track used to hang off
 * an order, so a client paying every month opened their portal and saw
 * nothing at all while we were editing for them. This is the screen that
 * fixes that.
 *
 * Slots are counted from the videos attached to the CURRENT cycle, so the
 * count resets on its own at renewal with nothing to run and nothing to
 * forget. Nothing rolls over, by decision. A cancelled request hands its slot
 * back, also by decision, so "2 left" always means "you can ask for 2 more".
 */

type Row = Record<string, unknown>;
const CUTS_MAX = 10;

async function planFor(db: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data } = await db
    .from("subscriptions")
    .select(
      "id, status, amount_cents, currency, current_period_end, cancel_at_period_end, plan_name, created_at, metadata, product:products(sku, name)",
    )
    .ilike("customer_email", email)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .maybeSingle();
  return data;
}

const skuOf = (sub: Row | null) =>
  sub
    ? (((sub.product as { sku?: string } | null)?.sku ??
        (sub.metadata as { sku?: string } | null)?.sku) ||
      null)
    : null;

/* every column a video is described by, current month or long finished */
const VIDEO_FIELDS =
  "id, parent_id, title, status, edit_type, credit_cost, runtime_minutes, aspect, note, due_at, requested_due_at, assets_ready_at, assets_url, reference_url, video_url, revision_round, cancelled_at, cancelled_reason, created_at";

/*
 * One video, as the client reads it.
 *
 * Shared by this month and by every month before it, because a video does
 * not become a different kind of thing when its month ends. A finished cut
 * from March is still watchable, still has its brief, and still says what it
 * was; only the counting stops.
 */
function shapeVideo(v: Row) {
  const status = String(v.status);
  const column = columnFor({
    status,
    assetsReadyAt: (v.assets_ready_at as string | null) ?? null,
  });
  return {
    id: String(v.id),
    parentId: (v.parent_id as string | null) ?? null,
    title: String(v.title),
    status,
    /* the word THEY read, which is not always our word for it */
    state: CLIENT_STATUS_WORD[column] ?? status,
    column,
    editType: (v.edit_type as EditType | null) ?? null,
    typeLabel: typeLabelFor(v.edit_type as string | null),
    creditCost: Number(v.credit_cost ?? 0),
    runtimeMinutes: v.runtime_minutes == null ? null : Number(v.runtime_minutes),
    aspect: (v.aspect as string | null) ?? null,
    brief: (v.note as string | null) ?? null,
    dueAt: (v.due_at as string | null) ?? null,
    requestedDueAt: (v.requested_due_at as string | null) ?? null,
    assetsReadyAt: (v.assets_ready_at as string | null) ?? null,
    assetsUrl: (v.assets_url as string | null) ?? null,
    /* withheld until it is genuinely watchable, the same rule the rest of
     * the portal follows: a client finding an unfinished cut is the exact
     * accident this prevents */
    videoUrl:
      status === "ready" || status === "revisions" || status === "approved"
        ? ((v.video_url as string | null) ?? null)
        : null,
    canReview: status === "ready" || status === "revisions",
    /* every editing tier sells unlimited revisions, so they get them */
    revisionsUsed: Number(v.revision_round ?? 0),
    cancelledAt: (v.cancelled_at as string | null) ?? null,
    cancelledReason: (v.cancelled_reason as string | null) ?? null,
    /* they can pull a request back while it is still only a request */
    canCancel: !v.cancelled_at && status === "queued",
    createdAt: String(v.created_at),
  };
}

const cycleArgs = (sub: Row) => ({
  id: String(sub.id),
  current_period_end: (sub.current_period_end as string | null) ?? null,
  product: { sku: skuOf(sub) },
});

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ plan: null });
  if (!contextCan(ctx, "subscriptions")) return NextResponse.json({ plan: null });

  const sub = await planFor(db, ctx.ownerEmail);
  if (!sub) return NextResponse.json({ plan: null });

  const cycle = await currentCycle(db, cycleArgs(sub as Row));
  if (!cycle) return NextResponse.json({ plan: null });

  const { data: videos } = await db
    .from("order_deliverables")
    .select(VIDEO_FIELDS)
    .eq("cycle_id", cycle.id)
    .order("created_at", { ascending: false });

  const items = ((videos ?? []) as Row[]).map(shapeVideo);

  const topup = await topupCreditsLeft(db, String(sub.id));
  const use = creditsUsed(items, cycle.creditsAllowed, topup);

  const sku = skuOf(sub as Row);
  const planName = (sub.plan_name as string | null) ?? planNameFor(sku);

  /* past months, so a client can see what they got for what they paid */
  const history = await cycleHistory(db, String(sub.id));
  const pastIds = history.filter((h) => h.id !== cycle.id).map((h) => h.id);
  /*
   * The videos themselves, not only how many there were.
   *
   * A month ending used to take its work off the client's screen entirely:
   * the counts survived, the videos did not, so "where is the cut you made
   * us in March" had no answer anywhere in the portal. Everything they have
   * ever been made comes back now, month by month.
   */
  const { data: pastVideos } = pastIds.length
    ? await db
        .from("order_deliverables")
        .select(`cycle_id, ${VIDEO_FIELDS}`)
        .in("cycle_id", pastIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({
    plan: {
      planName,
      sku,
      includes: planFeatures(sku),
      status: String(sub.status),
      amountCents: Number(sub.amount_cents ?? 0),
      renewsAt: (sub.current_period_end as string | null) ?? null,
      endingAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      aspects: ASPECTS.map((a) => ({ ...a })),
      cycle: { id: cycle.id, startsAt: cycle.periodStart, endsAt: cycle.periodEnd },
      credits: { ...use, summary: describeCredits(use) },
      /* the price list, so the client sees the cost of a shape before they
         pick it rather than after they have spent it */
      tiers: EDIT_TIERS.map((t) => ({ ...t })),
      /* the way out of a spent month, priced, so "you have run out" is never
         a dead end on the screen */
      topups: TOPUP_PACKS.map((t) => ({ ...t })),
      videos: items,
      history: history
        .filter((h) => h.id !== cycle.id)
        .map((h) => {
          const mine = ((pastVideos ?? []) as Row[]).filter(
            (v) => String(v.cycle_id) === h.id && !v.cancelled_at,
          );
          return {
            id: h.id,
            startsAt: h.periodStart,
            endsAt: h.periodEnd,
            creditsUsed: mine.reduce((n, v) => n + Number(v.credit_cost ?? 0), 0),
            creditsAllowed: h.creditsAllowed,
            /* what we actually made them that month */
            videos: ((pastVideos ?? []) as Row[])
              .filter((v) => String(v.cycle_id) === h.id)
              .map(shapeVideo),
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
 *
 * A long form request may carry short cuts taken from it. Each cut becomes a
 * video of its own, hanging off the long one, because that is what it is: a
 * separate job off the same footage, with its own slot, its own review and
 * its own approval. One long form plus three cuts spends one long slot and
 * three short ones.
 */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "subscriptions"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /* cancelling a request is a POST too, so the client needs one route */
  if (typeof b.cancel === "string") return cancel(db, ctx.ownerEmail, b.cancel);
  if (typeof b.edit === "string") return edit(db, ctx.ownerEmail, b.edit, b);

  const title = typeof b.title === "string" ? b.title.trim().slice(0, 160) : "";
  const brief = typeof b.brief === "string" ? b.brief.trim().slice(0, 4000) : "";
  const editType = (tierFor(typeof b.editType === "string" ? b.editType : "")?.key ??
    "mid") as EditType;
  const runtimeMinutes =
    typeof b.runtimeMinutes === "number" && Number.isFinite(b.runtimeMinutes) && b.runtimeMinutes > 0
      ? Math.min(600, Math.round(b.runtimeMinutes * 10) / 10)
      : null;
  const cost = creditCost(editType, runtimeMinutes);
  const assetsUrl = typeof b.assetsUrl === "string" ? b.assetsUrl.trim().slice(0, 1000) : "";
  const referenceUrl =
    typeof b.referenceUrl === "string" ? b.referenceUrl.trim().slice(0, 1000) : "";
  const aspect = ASPECTS.some((a) => a.key === b.aspect) ? (b.aspect as Aspect) : null;
  const targetSeconds =
    Number.isFinite(Number(b.targetMinutes)) && Number(b.targetMinutes) > 0
      ? Math.round(Number(b.targetMinutes) * 60)
      : null;
  const wantedBy =
    typeof b.requestedDueAt === "string" && b.requestedDueAt ? b.requestedDueAt : null;

  /* short cuts, only ever off a long form or podcast request: there is
     nothing to cut down from a video that is already short */
  const cuts =
    (editType === "long" || editType === "mid" || isPodcast(editType)) && Array.isArray(b.cuts)
      ? (b.cuts as unknown[])
          .map((c) =>
            typeof c === "string"
              ? c.trim().slice(0, 400)
              : typeof (c as Row)?.instruction === "string"
                ? String((c as Row).instruction).trim().slice(0, 400)
                : "",
          )
          .filter(Boolean)
          .slice(0, CUTS_MAX)
      : [];

  if (!title) return NextResponse.json({ error: "Give the video a name." }, { status: 400 });
  /* No brief required (owner decision, 25 August 2026). A client who has a
     style guide on file has already told us how they want things cut, and
     making them retype it every request is friction for nothing. The footage
     and a name are what we cannot work without. */
  if (!assetsUrl)
    return NextResponse.json(
      { error: "Paste the link to your footage. Drive, Dropbox, Frame.io, whatever you use." },
      { status: 400 },
    );

  const sub = await planFor(db, ctx.ownerEmail);
  if (!sub) return NextResponse.json({ error: "You have no active plan." }, { status: 400 });
  const cycle = await currentCycle(db, cycleArgs(sub as Row));
  if (!cycle) return NextResponse.json({ error: "You have no active plan." }, { status: 400 });

  const { data: existing } = await db
    .from("order_deliverables")
    .select("id, credit_cost, cancelled_at")
    .eq("cycle_id", cycle.id);
  const topup = await topupCreditsLeft(db, String(sub.id));
  const before = creditsUsed(
    ((existing ?? []) as Row[]).map((v) => ({
      creditCost: Number(v.credit_cost ?? 0),
      cancelledAt: (v.cancelled_at as string | null) ?? null,
    })),
    cycle.creditsAllowed,
    topup,
  );

  const planName = (sub.plan_name as string | null) ?? planNameFor(skuOf(sub as Row));

  /*
   * The warning covers everything this one submission spends, not just the
   * parent. Somebody asking for a long form with four cuts when three
   * credits are left needs telling before they press it, not after.
   */
  const cutsCost = cuts.length * creditCost("short");
  const totalCost = cost + cutsCost;
  const warnings = [overPlanWarning(before, totalCost, planName)].filter(
    Boolean,
  ) as string[];

  const now = new Date().toISOString();
  const { data: made, error } = await db
    .from("order_deliverables")
    .insert({
      cycle_id: cycle.id,
      title,
      note: brief,
      edit_type: editType,
      credit_cost: cost,
      runtime_minutes: runtimeMinutes,
      /* the old two-value column, still written so anything reading the
         previous vocabulary keeps working through the changeover */
      form: editType === "short" ? "short" : "long",
      status: "queued",
      aspect,
      target_seconds: targetSeconds,
      assets_url: assetsUrl,
      reference_url: referenceUrl || null,
      /* their ask, kept apart from due_at, which is what we commit to */
      requested_due_at: wantedBy,
      requested_at: now,
      position: (existing ?? []).length,
    })
    .select("id")
    .single();
  if (error || !made) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  if (cuts.length) {
    const { error: cutError } = await db.from("order_deliverables").insert(
      cuts.map((instruction, i) => ({
        cycle_id: cycle.id,
        parent_id: made.id,
        title: `${title}, short cut ${i + 1}`,
        note: instruction,
        edit_type: "short",
        credit_cost: creditCost("short"),
        form: "short",
        status: "queued",
        aspect: "9:16",
        assets_url: assetsUrl,
        requested_due_at: wantedBy,
        requested_at: now,
        position: (existing ?? []).length + i + 1,
      })),
    );
    /* the parent is already in. A failed cut is worth saying out loud
     * rather than silently losing. */
    if (cutError)
      return NextResponse.json(
        {
          ok: true,
          warning:
            "We have your video, but the short cuts did not save. Tell your producer and they will add them.",
        },
        { status: 200 },
      );
  }

  const { pushAdminNotifications } = await import("@/lib/notifications");
  await pushAdminNotifications(db, {
    kind: "edit_requested",
    title: `Edit requested: ${title}`,
    body: `${ctx.ownerEmail}, ${tierFor(editType)?.label ?? editType}, ${totalCost} ${totalCost === 1 ? "credit" : "credits"}${cuts.length ? ` including ${cuts.length} short ${cuts.length === 1 ? "cut" : "cuts"}` : ""}${wantedBy ? `, wants it by ${wantedBy.slice(0, 10)}` : ""}${warnings.length ? ". Over their plan this month." : ""}`,
    href: "editing",
    vars: {
      title,
      customer_email: ctx.ownerEmail,
      summary: `${ctx.ownerEmail}, ${tierFor(editType)?.label ?? editType}, ${totalCost} ${totalCost === 1 ? "credit" : "credits"}${cuts.length ? ` including ${cuts.length} short ${cuts.length === 1 ? "cut" : "cuts"}` : ""}${wantedBy ? `, wants it by ${wantedBy.slice(0, 10)}` : ""}${warnings.length ? ". Over their plan this month." : ""}`,
    },
  });

  /* the bell alone let a live client's first three requests sit unread with
     the earliest one wanted the next day. Fail-soft: the request is saved. */
  const { sendEditRequestedAlert } = await import("@/lib/email/notify");
  await sendEditRequestedAlert(db, {
    customerEmail: ctx.ownerEmail,
    title,
    brief,
    assetsUrl,
    wantedBy: wantedBy ?? null,
    planLine: `${tierFor(editType)?.label ?? editType}, ${totalCost} ${totalCost === 1 ? "credit" : "credits"}${cuts.length ? ` including ${cuts.length} short ${cuts.length === 1 ? "cut" : "cuts"}` : ""}${warnings.length ? ". Over their plan this month." : "."}`,
  });

  return NextResponse.json({
    ok: true,
    /* the caller needs it to hang any files they picked on the way in: the
       request has to exist before anything can be attached to it */
    id: made.id,
    warning: warnings[0] ?? null,
    cuts: cuts.length,
  });
}

/**
 * Is this deliverable on a cycle this email owns?
 *
 * Both cancel and edit have to prove it before touching a row, and proving
 * it twice in two slightly different ways is how one of them ends up wrong.
 */
async function ownedRequest(
  db: ReturnType<typeof supabaseAdmin>,
  email: string,
  id: string,
) {
  const { data: row } = await db
    .from("order_deliverables")
    .select(
      "id, status, cycle_id, cancelled_at, title, note, assets_url, assets_ready_at, reference_url, aspect, requested_due_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row?.cycle_id) return null;
  const { data: cyc } = await db
    .from("subscription_cycles")
    .select("subscription:subscriptions!inner(customer_email)")
    .eq("id", row.cycle_id)
    .maybeSingle();
  const owner = (cyc?.subscription as { customer_email?: string } | null)?.customer_email ?? "";
  return owner.toLowerCase() === email.toLowerCase() ? row : null;
}

/*
 * Change a request that is already in.
 *
 * A wrong footage link used to mean a message, a reply, and somebody in
 * admin typing it in. The client can fix their own now, along with the name,
 * the notes, the reference and the date they were hoping for.
 *
 * What is NOT here is the type, the runtime and therefore the price. Those
 * decide what the month is charged, and letting a form re-charge a client
 * mid-flight is a money path that deserves its own thinking rather than a
 * field on an edit sheet. While a request is still queued they can pull it
 * back, which returns the credits, and ask again. After that it is a
 * conversation with their producer, which is the right shape for "we have
 * already started and now it is a different video".
 *
 * The shape (dimension) IS editable, because it costs nothing to change.
 *
 * Editing re-opens the footage check: a new link is a link nobody has
 * opened, so the turnaround clock starts again from when we look at it,
 * which is the same rule the request itself runs on.
 */
async function edit(
  db: ReturnType<typeof supabaseAdmin>,
  email: string,
  id: string,
  b: Record<string, unknown>,
) {
  const row = await ownedRequest(db, email, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (row.cancelled_at)
    return NextResponse.json({ error: "That request was cancelled." }, { status: 400 });
  if (row.status === "approved")
    return NextResponse.json(
      { error: "You have approved this one, so it is finished. Message us and we will reopen it." },
      { status: 400 },
    );

  /*
   * Only what actually moved.
   *
   * The form posts every field whether it was touched or not, so patching
   * all of them would rewrite a row with its own values and, worse, tell the
   * studio the client "changed the instructions, the reference, the shape
   * and the date" when they fixed a typo in the name. A diff is the honest
   * version, and it is also the one that does not churn the row.
   */
  const patch: Record<string, unknown> = {};
  const set = (col: string, next: unknown, current: unknown) => {
    if (next !== current) patch[col] = next;
  };

  if (typeof b.title === "string") {
    const title = b.title.trim().slice(0, 160);
    if (!title) return NextResponse.json({ error: "Give the video a name." }, { status: 400 });
    set("title", title, row.title);
  }
  if (typeof b.brief === "string") set("note", b.brief.trim().slice(0, 4000), row.note ?? "");
  if (typeof b.referenceUrl === "string")
    set("reference_url", b.referenceUrl.trim().slice(0, 1000) || null, row.reference_url ?? null);
  if (ASPECTS.some((a) => a.key === b.aspect)) set("aspect", b.aspect, row.aspect);
  if (typeof b.requestedDueAt === "string") {
    const wanted = b.requestedDueAt ? new Date(b.requestedDueAt).toISOString() : null;
    /* stored with a time, entered as a day, so compare the day */
    const had = (row.requested_due_at as string | null) ?? null;
    if ((wanted ?? "").slice(0, 10) !== (had ?? "").slice(0, 10)) patch.requested_due_at = wanted;
  }

  const footageChanged =
    typeof b.assetsUrl === "string" && b.assetsUrl.trim().slice(0, 1000) !== (row.assets_url ?? "");
  if (typeof b.assetsUrl === "string") {
    const assetsUrl = b.assetsUrl.trim().slice(0, 1000);
    if (!assetsUrl)
      return NextResponse.json({ error: "We need a link to your footage." }, { status: 400 });
    if (footageChanged) {
      patch.assets_url = assetsUrl;
      /* a link nobody has opened is not a checked link, whatever we had
         already decided about the old one */
      patch.assets_ready_at = null;
      patch.due_at = null;
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  patch.updated_at = new Date().toISOString();
  const { error } = await db.from("order_deliverables").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 400 });

  /* the studio has to hear about it, because the thing they were told to
     make is not quite the thing any more */
  const changed = Object.keys(patch)
    .filter((k) => k !== "updated_at" && k !== "assets_ready_at" && k !== "due_at")
    .map((k) => FIELD_WORDS[k] ?? k)
    .join(", ");
  const summary = `${email} changed ${changed}.${
    footageChanged ? " New footage link, so it needs checking again." : ""
  }`;
  const { pushAdminNotifications } = await import("@/lib/notifications");
  await pushAdminNotifications(db, {
    kind: "edit_changed",
    title: `Request changed: ${patch.title ?? row.title}`,
    body: summary,
    href: "editing",
    vars: { title: String(patch.title ?? row.title), summary, customer_email: email },
  });

  return NextResponse.json({ ok: true, footageChanged });
}

/** The studio reads these, so they are said in words rather than columns. */
const FIELD_WORDS: Record<string, string> = {
  title: "the name",
  note: "the instructions",
  assets_url: "the footage link",
  reference_url: "the reference",
  aspect: "the shape",
  requested_due_at: "the date they want it",
};

/*
 * Pull a request back.
 *
 * Only while it is still only a request. Once an editor has started, the
 * work has happened and the slot has been spent; at that point they ask
 * their producer rather than press a button, which is also the point at
 * which somebody should be having a conversation about it.
 */
async function cancel(
  db: ReturnType<typeof supabaseAdmin>,
  email: string,
  id: string,
) {
  const row = await ownedRequest(db, email, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (row.cancelled_at) return NextResponse.json({ ok: true });

  if (row.status !== "queued")
    return NextResponse.json(
      { error: "We have already started this one. Message your producer and we will sort it." },
      { status: 400 },
    );

  const at = new Date().toISOString();
  /* the cuts go with it: they only ever existed off this video */
  await db
    .from("order_deliverables")
    .update({ cancelled_at: at, cancelled_reason: "Cancelled by the client" })
    .or(`id.eq.${id},parent_id.eq.${id}`);

  return NextResponse.json({ ok: true, cancelled: true });
}
