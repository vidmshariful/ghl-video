import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { isWatchable, type DeliverableStatus } from "@/lib/deliverable-status";

export const runtime = "nodejs";

/*
 * Download a finished video.
 *
 * The plain <a download> attribute is ignored across origins, so a link
 * straight at the HighLevel CDN opened the file in a tab and played it. The
 * browser only honours download for a same-origin response, so we fetch the
 * file here and hand it back with a filename attached.
 *
 * Streamed, not buffered: a 200MB video must not sit in this process's memory
 * on the way through.
 */
function safeName(title: string): string {
  const base = title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "video"}.mp4`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "No access." }, { status: 403 });

  const { id } = await params;
  const { data: d } = await db
    .from("order_deliverables")
    .select("id, title, status, video_url, order_id, project_id, cycle_id")
    .eq("id", id)
    .maybeSingle();
  if (!d?.video_url) return NextResponse.json({ error: "Not found." }, { status: 404 });

  /*
   * The same two gates the portal itself applies: it has to be theirs, and
   * the video has to be one they are allowed to watch.
   *
   * "Theirs" has three shapes now. This route only knew about orders, so a
   * custom or editing video could be watched in the portal and then failed
   * to download, which reads as the file being broken rather than as us
   * having forgotten a branch.
   */
  const mine = await ownedBy(db, d, ctx.ownerEmail);
  if (!mine.owned) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (mine.refunded) return NextResponse.json({ error: "Not available." }, { status: 403 });
  if (!isWatchable(d.status as DeliverableStatus))
    return NextResponse.json({ error: "That video is not ready yet." }, { status: 403 });

  const upstream = await fetch(d.video_url as string).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch that video." }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "video/mp4",
      ...(upstream.headers.get("content-length")
        ? { "content-length": upstream.headers.get("content-length") as string }
        : {}),
      "content-disposition": `attachment; filename="${safeName(d.title as string)}"`,
      "cache-control": "private, no-store",
    },
  });
}

/** Whose video is this, across all three owners a video can have. */
async function ownedBy(
  db: ReturnType<typeof supabaseAdmin>,
  d: Record<string, unknown>,
  email: string,
): Promise<{ owned: boolean; refunded: boolean }> {
  if (d.order_id) {
    const { data } = await db
      .from("orders")
      .select("id, status")
      .eq("id", d.order_id as string)
      .ilike("customer_email", email)
      .maybeSingle();
    return { owned: Boolean(data), refunded: data?.status === "refunded" };
  }
  if (d.project_id) {
    const { data } = await db
      .from("projects")
      .select("id")
      .eq("id", d.project_id as string)
      .ilike("customer_email", email)
      .maybeSingle();
    return { owned: Boolean(data), refunded: false };
  }
  if (d.cycle_id) {
    const { data } = await db
      .from("subscription_cycles")
      .select("subscription:subscriptions!inner(customer_email)")
      .eq("id", d.cycle_id as string)
      .maybeSingle();
    const owner =
      (data?.subscription as { customer_email?: string } | null)?.customer_email ?? "";
    return { owned: owner.toLowerCase() === email.toLowerCase(), refunded: false };
  }
  return { owned: false, refunded: false };
}
