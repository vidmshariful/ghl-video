import { NextResponse } from "next/server";
import { verifyAdminFor } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { CHASE_MAX, daysWaiting } from "@/lib/pipeline";
import { priorChases } from "@/lib/chase-rules";
import { approvedForThemLine } from "@/lib/quiet-client";
import { likeLiteral } from "@/lib/pg-pattern";

export const runtime = "nodejs";

/*
 * The producer's own hand on a waiting order, from the board or the queue:
 * nudge the client for their brief, nudge them about videos sitting in
 * review, or approve those videos for them (Premade review, 16 September
 * 2026). The nudges count against the same two the morning sweep is allowed,
 * read from the same ledger, so a producer cannot send a third by hand.
 */
type Action = "nudge-brief" | "nudge-review" | "approve";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminFor(req, ["orders", "production"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; deliverableId?: string };
  const action = body.action as Action;
  if (!["nudge-brief", "nudge-review", "approve"].includes(action)) {
    return NextResponse.json({ error: "Which action?" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, customer_email, status, fulfillment_stage, intake_completed, archived, customers(name)")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (order.status !== "paid" || order.fulfillment_stage === "delivered") {
    return NextResponse.json({ error: "This order is not being worked." }, { status: 409 });
  }
  const email = String(order.customer_email);
  const name = ((order.customers as { name?: string | null } | { name?: string | null }[] | null) && (Array.isArray(order.customers) ? order.customers[0]?.name : (order.customers as { name?: string | null } | null)?.name)) ?? null;
  const now = new Date().toISOString();

  if (action === "nudge-brief") {
    if (order.intake_completed) return NextResponse.json({ error: "The brief is in." }, { status: 409 });
    const { data: sent } = await db
      .from("email_log")
      .select("id, meta")
      .eq("template_key", "intake_reminder")
      .in("status", ["sent", "failed"])
      .ilike("to_email", likeLiteral(email));
    const count = (sent ?? []).filter((r) => ((r.meta ?? {}) as { orderId?: string }).orderId === id).length;
    if (count >= CHASE_MAX) {
      return NextResponse.json({ error: "Both reminders have gone. This one is a phone call now, or enter the brief for them." }, { status: 409 });
    }
    const { sendBriefReminderEmail } = await import("@/lib/email/notify");
    const ok = await sendBriefReminderEmail(db, id);
    if (!ok) return NextResponse.json({ error: "The reminder was not sent. The email log says why." }, { status: 502 });
    return NextResponse.json({ ok, sent: count + 1, of: CHASE_MAX });
  }

  /* the videos with the client, or the one that was pointed at */
  let q = db
    .from("order_deliverables")
    .select("id, title, ready_at")
    .eq("order_id", id)
    .eq("status", "ready")
    .is("parent_id", null)
    .order("position");
  if (typeof body.deliverableId === "string" && body.deliverableId) q = q.eq("id", body.deliverableId);
  const { data: videos } = await q;
  if (!videos?.length) return NextResponse.json({ error: "Nothing is with the client on this order." }, { status: 409 });

  if (action === "nudge-review") {
    const { data: ledgerRows } = await db
      .from("email_log")
      .select("meta, created_at")
      .in("template_key", ["approval_reminder", "approval_reminder_batch"])
      .in("status", ["sent", "failed"])
      .ilike("to_email", likeLiteral(email));
    const ledger = (ledgerRows ?? []) as { meta?: unknown; created_at?: unknown }[];
    const due = videos.filter((v) => priorChases(ledger, String(v.id), "review").count < CHASE_MAX);
    const spent = videos.filter((v) => !due.includes(v)).map((v) => String(v.title));
    if (!due.length) {
      return NextResponse.json({ error: "Both reminders have gone for these. Approve them for the client, or call.", spent }, { status: 409 });
    }
    const items = due.map((v) => ({
      videoTitle: String(v.title),
      stageLabel: "Your review",
      daysWaiting: daysWaiting(String(v.ready_at ?? now), now),
      deliverableId: String(v.id),
      station: "review",
    }));
    const { sendApprovalReminderEmail, sendApprovalReminderBatchEmail } = await import("@/lib/email/notify");
    const ok =
      items.length === 1
        ? await sendApprovalReminderEmail(db, { email, name, ...items[0] })
        : await sendApprovalReminderBatchEmail(db, { email, name, items });
    if (!ok) return NextResponse.json({ error: "The reminder was not sent. The email log says why.", spent }, { status: 502 });
    return NextResponse.json({ ok, nudged: items.map((i) => i.videoTitle), spent });
  }

  /* approve: the same closing moves as the client's own approval, done for
     them, with one line on the order saying so and how to reopen it */
  const { approveOnBehalf } = await import("@/lib/review");
  const done: string[] = [];
  for (const v of videos) {
    const r = await approveOnBehalf(db, String(v.id), admin.email).catch(() => null);
    if (r?.ok) done.push(r.title);
  }
  if (!done.length) return NextResponse.json({ error: "Nothing could be approved." }, { status: 409 });
  const line = approvedForThemLine(done);
  await db.from("order_updates").insert({ order_id: id, body: line });
  const { sendOrderUpdateEmail } = await import("@/lib/email/order-update");
  await sendOrderUpdateEmail(db, id, line).catch(() => false);
  return NextResponse.json({ ok: true, approved: done });
}
