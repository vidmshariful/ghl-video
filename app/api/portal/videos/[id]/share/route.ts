import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * A shareable link for one finished cut.
 *
 * The client mints it to show their own team the video without handing them
 * a portal login. The token is the whole key: it opens exactly one video on
 * a lightly branded public page and nothing else about the account. Clearing
 * it revokes every link that was ever copied.
 *
 * Same ownership rule as the review route: the video must hang off an order
 * or a project under the acting account, because the id comes from the
 * browser and being signed in is not on its own permission.
 */

async function guard(req: Request, deliverableId: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "orders"))
    return { fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };

  const { data: d } = await db
    .from("order_deliverables")
    .select("id, order_id, project_id, cycle_id, video_url, share_token, status")
    .eq("id", deliverableId)
    .maybeSingle();
  if (!d) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  /*
   * Whose video is this. Work belongs to a purchase, a custom project, or a
   * monthly plan, and this knew about the first two: an editing client
   * pressing Share fell off the end of the checks and was told Not found, on
   * a button the review popup shows them unconditionally.
   *
   * Case-insensitively on all three. Orders were compared with eq and
   * projects with ilike, so the same address stored with a capital letter
   * matched one and not the other.
   */
  if (d.order_id) {
    const { data: order } = await db
      .from("orders")
      .select("id")
      .eq("id", d.order_id)
      .ilike("customer_email", ctx.ownerEmail)
      .maybeSingle();
    if (!order) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    return { db, deliverable: d };
  }
  if (d.project_id) {
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", d.project_id)
      .ilike("customer_email", ctx.ownerEmail)
      .maybeSingle();
    if (!project) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    return { db, deliverable: d };
  }
  if (d.cycle_id) {
    const { data: cycle } = await db
      .from("subscription_cycles")
      .select("subscription:subscriptions!inner(customer_email)")
      .eq("id", d.cycle_id)
      .maybeSingle();
    const owner =
      (cycle?.subscription as { customer_email?: string } | null)?.customer_email ?? "";
    if (owner.toLowerCase() !== ctx.ownerEmail.toLowerCase())
      return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
    return { db, deliverable: d };
  }
  return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };
}

const linkFor = (req: Request, token: string) => `${new URL(req.url).origin}/v/${token}`;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;
  const token = (g.deliverable.share_token as string | null) ?? null;
  return NextResponse.json({ shared: Boolean(token), url: token ? linkFor(req, token) : null });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  if (!g.deliverable.video_url)
    return NextResponse.json(
      { error: "There is no video to share yet." },
      { status: 400 },
    );

  /* reuse an existing token so the link a client already copied keeps
     working; only mint a new one the first time */
  let token = (g.deliverable.share_token as string | null) ?? null;
  if (!token) {
    token = randomBytes(16).toString("base64url");
    const { error } = await g.db
      .from("order_deliverables")
      .update({ share_token: token })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ shared: true, url: linkFor(req, token) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;
  await g.db.from("order_deliverables").update({ share_token: null }).eq("id", id);
  return NextResponse.json({ shared: false, url: null });
}
