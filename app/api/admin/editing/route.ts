import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import {
  currentCycle,
  planNameFor,
  planPriority,
  topupCreditsLeft,
} from "@/lib/subscription-cycles";
import { creditsUsed, queueOrder } from "@/lib/subscription-slots";
import { creditCost, tierFor, type EditType } from "@/lib/editing-credits";
import { ASPECTS, columnFor, qcPassed, type Aspect, type Qc } from "@/lib/editing-sop";
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
  "id, customer_email, plan_name, status, amount_cents, current_period_end, metadata, product:products(sku, name), customer:customers(name, company, slug)";

/* Who can be put on a job. Sales reps are not production, so they are not
   offered; the executive producer sorts to the top because that is who takes
   the work by default. */
const PRODUCTION_ROLES = ["admin", "manager"];

/*
 * The executive producer.
 *
 * Editing work is not assigned to editors here, by decision (August 2026):
 * the editors work in ClickUp, and what this board tracks is who is running
 * the job with the client. That is Tanvir. If the role ever changes hands,
 * this is the one line to change; if the address is not on the team any
 * more, the picker quietly falls back to whoever is.
 */
const EXECUTIVE_PRODUCER = "prince@vidiosa.com";

/*
 * The handle in the URL, turned back into a subscription.
 *
 * /admin/editing/extendly is worth sending to somebody; a uuid is not. The
 * slug belongs to the client, so it resolves through them to whichever plan
 * they are currently on.
 */
async function subscriptionForSlug(db: ReturnType<typeof supabaseAdmin>, slug: string) {
  const { data: customer } = await db
    .from("customers")
    .select("email")
    .eq("slug", slug)
    .maybeSingle();
  if (!customer?.email) return null;
  const { data: sub } = await db
    .from("subscriptions")
    .select("id")
    .ilike("customer_email", String(customer.email))
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .maybeSingle();
  return sub?.id ? String(sub.id) : null;
}

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
    editType: (d.edit_type as EditType | null) ?? null,
    typeLabel: tierFor(String(d.edit_type ?? ""))?.label ?? null,
    creditCost: Number(d.credit_cost ?? 0),
    runtimeMinutes: d.runtime_minutes == null ? null : Number(d.runtime_minutes),
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
  const q = new URL(req.url).searchParams;
  /* by uuid from a click, or by slug from a pasted URL */
  const slug = q.get("client");
  const wanted = slug
    ? /* a client with no handle yet still opens, by id */
      UUID_RE.test(slug)
      ? slug
      : await subscriptionForSlug(db, slug)
    : q.get("subscription");
  if (slug && !wanted)
    return NextResponse.json(
      { error: "No editing client with that name." },
      { status: 404 },
    );

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

    /* how much of the client's feedback is still waiting on us, per video, so
       the board can say so on the card rather than leaving it to an email */
    const { openCountsByDeliverable } = await import("@/lib/review");
    const openNotes = await openCountsByDeliverable(
      db,
      ((rows ?? []) as Row[]).map((d) => String(d.id)),
    );

    const all = ((rows ?? []) as Row[]).map((d) => ({
      ...shape(d),
      cycleId: String(d.cycle_id),
      openNotes: openNotes[String(d.id)] ?? 0,
    }));

    const thisMonth = cycle ? all.filter((r) => r.cycleId === cycle.id) : [];
    const topup = await topupCreditsLeft(db, String(sub.id));
    const use = creditsUsed(thisMonth, cycle?.creditsAllowed ?? 0, topup);

    const { data: guide } = await db
      .from("editing_style_guides")
      .select("*")
      .eq("customer_email", String(sub.customer_email).toLowerCase())
      .maybeSingle();

    /* who can be put on a job */
    const { data: team } = await db.from("admins").select("email, name, role");
    const crew = ((team ?? []) as Row[])
      .filter((t) => PRODUCTION_ROLES.includes(String(t.role)))
      .sort((a, b) =>
        a.email === EXECUTIVE_PRODUCER ? -1 : b.email === EXECUTIVE_PRODUCER ? 1 : 0,
      )
      .map((t) => ({
        email: String(t.email),
        name: (t.name as string | null) ?? String(t.email),
      }));

    return NextResponse.json({
      client: {
        subscriptionId: String(sub.id),
        slug: (sub.customer as { slug?: string } | null)?.slug ?? null,
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
      credits: use,
      requests: all,
      styleGuide: guide ?? null,
      /* production only, and the producers first: the picker on this screen
         names who is running the work, not who sold it */
      team: crew,
      /* who a new request lands on: whoever already runs this account, then
         the executive producer, then anyone in production at all */
      defaultProducer:
        all.filter((r) => r.assignedTo).slice(-1)[0]?.assignedTo ??
        crew.find((t) => t.email === EXECUTIVE_PRODUCER)?.email ??
        crew[0]?.email ??
        null,
    });
  }

  /* ---------- the client list ---------- */
  const { data: subs } = await db
    .from("subscriptions")
    .select(SUB_FIELDS)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false });

  /*
   * One client's numbers need three round trips: their current cycle, that
   * cycle's deliverables, and any topped-up credits. This ran them client
   * after client, so the screen waited for three times however many clients
   * there are, one after another.
   *
   * Measured at two clients it is 460ms against 391ms, which is nothing. The
   * shape is the problem: it grows in a straight line, so twenty clients is
   * about four and a half seconds of waiting where this is under half a
   * second. Fixed now, while it is cheap to fix and nobody is shouting.
   *
   * Each client's work is independent, so nothing about the arithmetic
   * changes; only the waiting is shared. Order is preserved by map, and the
   * sort below owns the final order anyway.
   */
  const clients = await Promise.all(
    ((subs ?? []) as Row[]).map(async (sub) => {
      const sku = skuOf(sub);
      const cycle = await currentCycle(db, cycleArgs(sub));
      const { data: rows } = cycle
        ? await db
            .from("order_deliverables")
            .select("credit_cost, status, assets_ready_at, requested_due_at, cancelled_at, created_at")
            .eq("cycle_id", cycle.id)
        : { data: [] };

      const items = (rows ?? []) as Row[];
      const live = items.filter((r) => !r.cancelled_at);
      const use = creditsUsed(
        items.map((r) => ({
          creditCost: Number(r.credit_cost ?? 0),
          cancelledAt: (r.cancelled_at as string | null) ?? null,
        })),
        cycle?.creditsAllowed ?? 0,
        await topupCreditsLeft(db, String(sub.id)),
      );

      return {
        subscriptionId: String(sub.id),
        /* the handle their screen lives at */
        slug: (sub.customer as { slug?: string } | null)?.slug ?? null,
        email: String(sub.customer_email),
        name: (sub.customer as { name?: string } | null)?.name ?? null,
        company: (sub.customer as { company?: string } | null)?.company ?? null,
        planName: (sub.plan_name as string | null) ?? planNameFor(sku),
        sku,
        status: String(sub.status),
        renewsAt: (sub.current_period_end as string | null) ?? null,
        priority: planPriority(sku),
        credits: use,
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
      };
    }),
  );

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
    .select("id, status, qc, assets_ready_at, cycle_id, video_url, title")
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

  /*
   * The details, after the request is in.
   *
   * A wrong title or a brief that missed something used to be a message to a
   * producer who could not act on it either: nothing here was editable once
   * the row existed, on either side. The client could already fix their own
   * request; the studio could not fix anything at all.
   *
   * Type and length are deliberately NOT here. They set credit_cost, so
   * changing one re-bills the client's month, and that is a conversation
   * rather than a text field.
   */
  if (typeof b.title === "string" && b.title.trim())
    patch.title = b.title.trim().slice(0, 160);
  if (typeof b.brief === "string") patch.note = b.brief.trim().slice(0, 4000) || null;
  if (typeof b.aspect === "string") patch.aspect = b.aspect.trim().slice(0, 40) || null;

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

  /*
   * A revised cut is a new cut, not a correction to the old one.
   *
   * There is one link field, and pasting the revision into it used to
   * overwrite the version the client had already reviewed. Their notes stayed
   * behind, still pinned to seconds, but now pointing at a video nobody could
   * watch any more, and there was no way to tell which round a note belonged
   * to. Orders and custom projects have recorded every cut for months; plan
   * work was the one path that never called addVersion.
   *
   * The client's player already reads these and files older notes under the
   * cut they were written on, so recording them is the whole fix on that
   * side. addVersion ignores a repeat of the same URL, so saving the form
   * twice does not invent a v2.
   */
  if (typeof patch.video_url === "string" && patch.video_url !== before.video_url) {
    const { addVersion } = await import("@/lib/versions");
    await addVersion(db, id, patch.video_url as string, admin.email);
  }

  return NextResponse.json({ ok: true });
}

/*
 * Add a request the client did not type themselves.
 *
 * Plenty of editing work arrives by email, on WhatsApp or on a call, and
 * until now it could only live in somebody's head: the portal grew a request
 * only when the client filled the form in. This writes the same request from
 * our side, into the same month as theirs, so it lands on their plan screen
 * and on this board at once and nothing depends on remembering it.
 *
 * Footage is optional here and required there, on purpose. A client pasting a
 * link is the only way we would ever get one. A producer taking the job down
 * often has the files already, or is still waiting on them, which is exactly
 * what the Needs footage column is for.
 */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subscriptionId = typeof b.subscriptionId === "string" ? b.subscriptionId : "";
  if (!UUID_RE.test(subscriptionId))
    return NextResponse.json({ error: "Which client?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: sub } = await db
    .from("subscriptions")
    .select(SUB_FIELDS)
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const cycle = await currentCycle(db, cycleArgs(sub as Row));
  if (!cycle)
    return NextResponse.json(
      { error: "This plan has no open month, so there is nowhere to put the request." },
      { status: 400 },
    );

  const str = (k: string, max: number) =>
    typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "";

  const title = str("title", 160);
  const brief = str("brief", 4000);
  const editType = (tierFor(typeof b.editType === "string" ? b.editType : "")?.key ??
    "mid") as EditType;
  const runtimeMinutes =
    Number.isFinite(Number(b.runtimeMinutes)) && Number(b.runtimeMinutes) > 0
      ? Math.min(600, Math.round(Number(b.runtimeMinutes) * 10) / 10)
      : null;
  const cost = creditCost(editType, runtimeMinutes);
  const assetsUrl = str("assetsUrl", 1000);
  const referenceUrl = str("referenceUrl", 1000);
  const aspect = ASPECTS.some((a) => a.key === b.aspect) ? (b.aspect as Aspect) : null;
  const targetSeconds =
    Number.isFinite(Number(b.targetMinutes)) && Number(b.targetMinutes) > 0
      ? Math.round(Number(b.targetMinutes) * 60)
      : null;
  const wantedBy = str("requestedDueAt", 40) || null;
  const promised = str("dueAt", 40) || null;
  const assignedTo = str("assignedTo", 200) || null;

  if (!title) return NextResponse.json({ error: "Give the video a name." }, { status: 400 });
  if (!brief)
    return NextResponse.json(
      { error: "Write down what they asked for. The editor works from this." },
      { status: 400 },
    );

  /* short cuts, only ever off a long form request, exactly as the client form
     builds them: each one is its own video with its own slot */
  const cuts =
    editType !== "short" && Array.isArray(b.cuts)
      ? (b.cuts as unknown[])
          .map((c) => (typeof c === "string" ? c.trim().slice(0, 400) : ""))
          .filter(Boolean)
          .slice(0, 10)
      : [];

  const { data: existing } = await db
    .from("order_deliverables")
    .select("id, credit_cost, cancelled_at")
    .eq("cycle_id", cycle.id);

  const before = creditsUsed(
    ((existing ?? []) as Row[]).map((v) => ({
      creditCost: Number(v.credit_cost ?? 0),
      cancelledAt: (v.cancelled_at as string | null) ?? null,
    })),
    cycle.creditsAllowed,
    await topupCreditsLeft(db, String(sub.id)),
  );
  const planName = (sub.plan_name as string | null) ?? planNameFor(skuOf(sub as Row));

  /*
   * Over plan, said to us rather than to them.
   *
   * The client's form has a sentence for this already, but it is addressed to
   * the client: "your plan", "we will still take this one". On this side of
   * the desk the reader is the producer, and what they need is the count and
   * the conversation to have, so the sentence is written again here rather
   * than borrowed. Nothing is refused either way.
   */
  const totalCost = cost + cuts.length * creditCost("short");
  const warning =
    totalCost <= before.left
      ? null
      : `This spends ${totalCost} ${totalCost === 1 ? "credit" : "credits"} and they have ${before.left} left on ${planName}. ` +
        `It is in either way. Tell them it runs into next month, or sell them a top-up.`;

  const now = new Date().toISOString();
  /* footage we already have starts the promise clock now, the same stamp the
     Footage is in button writes */
  const readyAt = b.assetsReady ? now : null;

  const { data: made, error } = await db
    .from("order_deliverables")
    .insert({
      cycle_id: cycle.id,
      title,
      note: brief,
      edit_type: editType,
      credit_cost: cost,
      runtime_minutes: runtimeMinutes,
      form: editType === "short" ? "short" : "long",
      status: "queued",
      aspect,
      target_seconds: targetSeconds,
      assets_url: assetsUrl || null,
      reference_url: referenceUrl || null,
      requested_due_at: wantedBy,
      due_at: promised ? new Date(promised).toISOString() : null,
      assigned_admin_email: assignedTo,
      assets_ready_at: readyAt,
      requested_at: now,
      position: (existing ?? []).length,
    })
    .select("id")
    .single();
  if (error || !made)
    return NextResponse.json({ error: error?.message ?? "Could not save that." }, { status: 400 });

  if (cuts.length) {
    const { error: cutError } = await db.from("order_deliverables").insert(
      cuts.map((instruction, i) => ({
        cycle_id: cycle.id,
        parent_id: made.id,
        title: `${title}, short cut ${i + 1}`,
        note: instruction,
        form: "short",
        status: "queued",
        aspect: "9:16",
        assets_url: assetsUrl || null,
        requested_due_at: wantedBy,
        assets_ready_at: readyAt,
        requested_at: now,
        position: (existing ?? []).length + i + 1,
      })),
    );
    /* the video is already in. A failed cut is worth saying out loud rather
       than silently losing. */
    if (cutError)
      return NextResponse.json(
        {
          ok: true,
          id: made.id,
          warning: "The video saved but the short cuts did not. Add them again.",
        },
        { status: 200 },
      );
  }

  /*
   * Tell them it is in, unless whoever added it says not to. A request
   * appearing on their screen that they never typed reads as a mistake
   * without a line explaining it, and somebody back-filling a month of old
   * jobs does not want to send ten of these.
   */
  if (b.notify !== false) {
    const { pushNotification } = await import("@/lib/notifications");
    await pushNotification(db, {
      audience: "customer",
      email: String(sub.customer_email),
      kind: "edit_added",
      title: `We added your request: ${title}`,
      body: "You asked for this one outside the portal. It is on your plan now, so you can follow it with the rest.",
      href: "subscriptions",
      vars: { title },
    });
  }

  return NextResponse.json({ ok: true, id: made.id, warning, cuts: cuts.length });
}
