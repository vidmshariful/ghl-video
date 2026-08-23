import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { pushAdminNotifications } from "@/lib/notifications";
import {
  pickAsk,
  type ApprovedVideo,
  type FeedbackVerdict,
  type PriorAnswer,
} from "@/lib/feedback-ask";

export const runtime = "nodejs";

/*
 * The one-question ask: did the video do anything for you.
 *
 * GET returns at most ONE video to ask about, chosen by lib/feedback-ask.
 * The dashboard renders a small card for it or nothing at all; there is no
 * list endpoint on purpose, because a list is a survey.
 *
 * POST records the answer. Ownership is proved the same way orders are: the
 * deliverable must hang off a paid order belonging to the account this
 * session resolves to. The row is upserted so answering again (a stale rain
 * check coming back, or a note added a moment after the verdict) updates
 * rather than errors.
 */

type Row = Record<string, unknown>;

const VERDICTS: FeedbackVerdict[] = ["working", "too_early", "not_really", "skipped"];

async function accountVideos(db: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data: orders } = await db
    .from("orders")
    .select("id")
    .eq("customer_email", email)
    .eq("status", "paid");
  const ids = (orders ?? []).map((o) => o.id as string);
  if (!ids.length) return { ids, approved: [] as Row[] };
  const { data: approved } = await db
    .from("order_deliverables")
    .select("id, order_id, title, approved_at")
    .in("order_id", ids)
    .eq("status", "approved")
    .not("approved_at", "is", null);
  return { ids, approved: (approved ?? []) as Row[] };
}

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ ask: null });

  const { approved } = await accountVideos(db, ctx.ownerEmail);
  if (!approved.length) return NextResponse.json({ ask: null });

  const { data: prior } = await db
    .from("video_feedback")
    .select("deliverable_id, verdict, created_at")
    .in(
      "deliverable_id",
      approved.map((d) => d.id as string),
    );

  const candidates: ApprovedVideo[] = approved.map((d) => ({
    deliverableId: String(d.id),
    title: String(d.title),
    approvedAt: String(d.approved_at),
  }));
  const answers: PriorAnswer[] = ((prior ?? []) as Row[]).map((f) => ({
    deliverableId: String(f.deliverable_id),
    verdict: String(f.verdict) as FeedbackVerdict,
    answeredAt: String(f.created_at),
  }));

  const ask = pickAsk(candidates, answers, new Date());
  return NextResponse.json({
    ask: ask ? { deliverableId: ask.deliverableId, title: ask.title } : null,
  });
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const deliverableId = typeof b.deliverableId === "string" ? b.deliverableId : "";
  const verdict = VERDICTS.includes(b.verdict as FeedbackVerdict)
    ? (b.verdict as FeedbackVerdict)
    : null;
  const note =
    typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
  if (!deliverableId || !verdict) {
    return NextResponse.json({ error: "Nothing to record." }, { status: 400 });
  }

  /* theirs, or nothing happens */
  const { approved } = await accountVideos(db, ctx.ownerEmail);
  const video = approved.find((d) => String(d.id) === deliverableId);
  if (!video) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: prev } = await db
    .from("video_feedback")
    .select("verdict, note")
    .eq("deliverable_id", deliverableId)
    .maybeSingle();

  const { error } = await db.from("video_feedback").upsert(
    {
      deliverable_id: deliverableId,
      order_id: String(video.order_id),
      customer_email: ctx.ownerEmail,
      video_title: String(video.title),
      verdict,
      /* a note never gets blanked by a later verdict-only post */
      note: note ?? ((prev?.note as string | null) ?? null),
      created_at: new Date().toISOString(),
    },
    { onConflict: "deliverable_id" },
  );
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  /*
   * Tell the team, once per thing worth hearing: the first real answer, and
   * a note arriving after it. Skips are silence by intent, and repeats of
   * the same answer are double-clicks, not news.
   */
  const firstAnswer = !prev && verdict !== "skipped";
  const noteAdded = Boolean(prev && note && !prev.note);
  if (firstAnswer || noteAdded) {
    const said =
      verdict === "working"
        ? "It's working"
        : verdict === "not_really"
          ? "Not really"
          : "Too early to tell";
    await pushAdminNotifications(db, {
      kind: "video_feedback",
      title: `Client feedback: "${said}" on ${String(video.title)}`,
      body: note ?? ctx.ownerEmail,
      href: "orders",
      vars: {
        video_title: String(video.title),
        summary: `Said "${said}". ${note ?? ctx.ownerEmail}`,
        customer_name: ctx.ownerEmail,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
