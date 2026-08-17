import { NextResponse } from "next/server";
import { describeDue } from "@/lib/delivery-dates";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

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
 */
export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();

  const { data: orders } = await db
    .from("orders")
    .select(
      "id, invoice_number, customer_email, fulfillment_stage, intake_completed, intake_completed_at, assigned_admin_email, assigned_manager, customers(name), products(name)",
    )
    .eq("status", "paid")
    .neq("archived", true);

  const ids = (orders ?? []).map((o) => o.id as string);
  if (!ids.length) return NextResponse.json({ items: [], owners: [] });

  const [{ data: videos }, { data: notes }] = await Promise.all([
    db
      .from("order_deliverables")
      .select("id, order_id, title, status, position, ready_at, updated_at, revision_round, video_url, due_at")
      .in("order_id", ids)
      .order("position"),
    // unanswered client notes: no reply from us and not ticked off
    db
      .from("deliverable_comments")
      .select("id, deliverable_id, body, created_at, author_side, parent_id, resolved_at")
      .in("order_id", ids),
  ]);

  const byOrder = new Map((orders ?? []).map((o) => [o.id as string, o]));

  /* A client note counts as needing us until somebody replies to it or ticks
   * it off. Anything else and the queue would keep showing work already done. */
  const answered = new Set(
    (notes ?? []).filter((n) => n.parent_id).map((n) => n.parent_id as string),
  );
  const openByVideo = new Map<string, { body: string; at: string }[]>();
  for (const n of notes ?? []) {
    if (n.parent_id) continue;
    if (n.author_side !== "client") continue;
    if (n.resolved_at) continue;
    if (answered.has(n.id as string)) continue;
    const k = n.deliverable_id as string;
    openByVideo.set(k, [
      ...(openByVideo.get(k) ?? []),
      { body: n.body as string, at: n.created_at as string },
    ]);
  }

  const days = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

  const items = (videos ?? [])
    .map((v) => {
      const o = byOrder.get(v.order_id as string);
      if (!o) return null;
      const open = openByVideo.get(v.id as string) ?? [];
      const status = v.status as string;

      let bucket: "answer" | "revisions" | "start" | "waiting" | null = null;
      if (open.length) bucket = "answer";
      else if (status === "revisions") bucket = "revisions";
      else if (status === "queued" && o.intake_completed) bucket = "start";
      else if (status === "ready") bucket = "waiting";
      if (!bucket) return null;

      return {
        bucket,
        videoId: v.id as string,
        orderId: v.order_id as string,
        title: v.title as string,
        status,
        revisionRound: v.revision_round as number,
        hasLink: Boolean(v.video_url),
        openNotes: open.length,
        latestNote: open[open.length - 1]?.body?.slice(0, 120) ?? null,
        waitingDays: bucket === "waiting" ? days(v.ready_at as string | null) : null,
        /* What the client was promised. Worded server-side so the board and
         * the client's own screen can never say different things about the
         * same video. */
        due: describeDue(
          {
            dueAt: v.due_at as string | null,
            status,
            briefLandedAt: (o.intake_completed_at as string | null) ?? null,
          },
          Date.now(),
          "studio",
        ),
        sinceDays: days((v.updated_at as string) ?? null),
        customer:
          ((o.customers as unknown as { name: string | null } | null)?.name ??
            (o.customer_email as string)),
        invoice: o.invoice_number as string | null,
        product: (o.products as unknown as { name: string } | null)?.name ?? "Order",
        ownerEmail: o.assigned_admin_email as string | null,
        ownerName: o.assigned_manager as string | null,
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
