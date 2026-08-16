import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { createDeliverablesForOrder, listDeliverables } from "@/lib/deliverables";
import { deriveStage, stageReason } from "@/lib/order-stage";

export const runtime = "nodejs";

/*
 * One production job, everything the studio needs to work it: who it is for,
 * what is owed, where each video is, who owns it, and the client-facing
 * timeline. One request, because a job page that fires five is a job page that
 * flickers.
 *
 * The commercial side of the order (amount, payment, refunds) is deliberately
 * NOT here. That lives in Orders. This route is the work, not the money.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: order } = await db
    .from("orders")
    .select(
      "id, customer_email, invoice_number, fulfillment_stage, stage_changed_at, stage_is_derived, assigned_admin_email, assigned_manager, intake_completed, delivery_url, created_at, paid_at, status, customers(name), products(name, sku, metadata)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Build the video list on the spot if this order predates deliverables, so
  // opening a job is always enough to make it workable.
  let videos = await listDeliverables(db, id);
  if (!videos.length) {
    await createDeliverablesForOrder(db, id).catch(() => null);
    videos = await listDeliverables(db, id);
  }

  const [{ data: updates }, { data: team }] = await Promise.all([
    db
      .from("order_updates")
      .select("body, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    db.from("admins").select("email, name, role").order("name"),
  ]);

  const product = order.products as unknown as {
    name: string;
    sku: string;
    metadata: Record<string, unknown> | null;
  } | null;
  const customer = order.customers as unknown as { name: string | null } | null;

  const stageInput = {
    current: order.fulfillment_stage as string,
    intakeCompleted: Boolean(order.intake_completed),
    statuses: videos.map((v) => v.status),
  };

  return NextResponse.json({
    job: {
      id: order.id,
      invoiceNumber: order.invoice_number,
      customerName: customer?.name ?? null,
      customerEmail: order.customer_email,
      productName: product?.name ?? "Order",
      productCode:
        (product?.metadata?.code as string | undefined) ?? product?.sku?.toUpperCase() ?? null,
      productKind: (product?.metadata?.kind as string | undefined) ?? null,
      stage: order.fulfillment_stage,
      stageIsDerived: Boolean(order.stage_is_derived),
      stageChangedAt: order.stage_changed_at,
      // what the videos say it should be, so the page can offer to fix a
      // stage somebody set by hand and then left behind
      stageShouldBe: deriveStage(stageInput),
      stageReason: stageReason(stageInput),
      assignedEmail: order.assigned_admin_email,
      assignedName: order.assigned_manager,
      intakeCompleted: Boolean(order.intake_completed),
      deliveryUrl: order.delivery_url,
      orderStatus: order.status,
      createdAt: order.created_at,
      paidAt: order.paid_at,
    },
    videos,
    updates: (updates ?? []).map((u) => ({ body: u.body, createdAt: u.created_at })),
    team: (team ?? []).map((t) => ({
      email: t.email as string,
      name: (t.name as string | null) ?? (t.email as string),
      role: t.role as string,
    })),
  });
}

/* Job-level edits: who owns it, and the stage when a person overrides the
 * calculated one. Delivering is NOT here; that goes through the fulfillment
 * route, which owns the exactly-once delivery email. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  const patch: Record<string, unknown> = {};

  if ("assignedEmail" in body) {
    const email = typeof body.assignedEmail === "string" ? body.assignedEmail.trim() : "";
    if (!email) {
      patch.assigned_admin_email = null;
    } else {
      const { data: ok } = await db.from("admins").select("email, name").eq("email", email).maybeSingle();
      if (!ok) return NextResponse.json({ error: "That person is not on the team." }, { status: 400 });
      patch.assigned_admin_email = ok.email;
      // keep the display name in step so older screens still read right
      if (ok.name) patch.assigned_manager = ok.name;
    }
  }

  if (typeof body.stage === "string") {
    const STAGES = ["paid", "intake", "production", "review"];
    // Delivered is excluded on purpose: it sends the client's email and must
    // go through the fulfillment route's exactly-once transition.
    if (!STAGES.includes(body.stage)) {
      return NextResponse.json(
        { error: "Use the deliver button to mark an order delivered." },
        { status: 400 },
      );
    }
    patch.fulfillment_stage = body.stage;
    patch.stage_changed_at = new Date().toISOString();
    patch.stage_is_derived = false;
    patch.stage_set_by = admin.email;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db.from("orders").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("order_events").insert({
    order_id: id,
    event_type: "job_updated",
    payload: { by: admin.email, ...patch },
  });

  return NextResponse.json({ ok: true });
}
