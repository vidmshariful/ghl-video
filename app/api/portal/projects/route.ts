import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { CLIENT_LABEL, isOpen, type ProjectStatus } from "@/lib/projects";

export const runtime = "nodejs";

/*
 * The client's own custom work.
 *
 * Until now a custom client's portal was empty: their job had no order, so it
 * had no videos, so every screen showed them nothing while we were actively
 * making something for them.
 *
 * They see the client vocabulary, never ours. "Scoped" is a studio word that
 * a client reads as "you have not started", and "with client" is meaningless
 * from their side. Money is deliberately absent here: what they owe belongs
 * on an invoice they can actually pay, not scattered through a status screen.
 */

type Row = Record<string, unknown>;

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return NextResponse.json({ projects: [] });

  const { data: projects } = await db
    .from("projects")
    .select("id, title, brief, status, due_at, created_at")
    .ilike("customer_email", ctx.ownerEmail)
    .order("created_at", { ascending: false });

  const ids = ((projects ?? []) as Row[]).map((p) => String(p.id));
  const { data: videos } = ids.length
    ? await db
        .from("order_deliverables")
        .select("id, project_id, title, status, due_at, video_url, thumbnail_url, position")
        .in("project_id", ids)
        .order("position")
    : { data: [] };

  return NextResponse.json({
    projects: ((projects ?? []) as Row[])
      /* a cancelled job is not something to show somebody who is paying us */
      .filter((p) => String(p.status) !== "cancelled")
      .map((p) => {
        const status = String(p.status) as ProjectStatus;
        return {
          id: String(p.id),
          title: String(p.title),
          brief: (p.brief as string | null) ?? null,
          status,
          statusLabel: CLIENT_LABEL[status],
          open: isOpen(status),
          dueAt: (p.due_at as string | null) ?? null,
          createdAt: String(p.created_at),
          videos: ((videos ?? []) as Row[])
            .filter((v) => String(v.project_id) === String(p.id))
            .map((v) => ({
              id: String(v.id),
              title: String(v.title),
              status: String(v.status),
              dueAt: (v.due_at as string | null) ?? null,
              thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
            })),
        };
      }),
  });
}
