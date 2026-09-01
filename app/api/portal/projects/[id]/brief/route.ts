import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";

export const runtime = "nodejs";

/*
 * The project brief, editable by the client.
 *
 * It reads like a shared description box: what we agreed to make, kept current
 * by whoever knows best. The studio edits the same field from admin, so this
 * is last write wins on one text column, which is the right amount of
 * machinery for a brief two people who are talking to each other both touch.
 */

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const { data: project } = await db
    .from("projects")
    .select("id, title, brief")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const brief = typeof b.brief === "string" ? b.brief.slice(0, 8000) : "";

  const { error } = await db
    .from("projects")
    .update({ brief: brief.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /*
   * Tell the studio the brief moved.
   *
   * Last write wins is fine for a field two people who talk to each other
   * both edit. Silence is not: the studio can be halfway through building
   * the previous version and never learn it changed. Only on an actual
   * change, so opening the box and saving it untouched rings nothing, and
   * never when the edit came from our own side viewing as the client.
   */
  const before = ((project.brief as string | null) ?? "").trim();
  const after = brief.trim();
  if (before !== after && !ctx.viewingAsAdmin) {
    try {
      const { pushAdminNotifications } = await import("@/lib/notifications");
      await pushAdminNotifications(db, {
        kind: "project_brief_changed",
        title: `Brief changed: ${String(project.title ?? "project")}`,
        body: `${ctx.ownerEmail} edited the brief. Check it before the next cut.`,
        /* "custom/<id>" is what the admin bell routes on; "projects" is not
           a view, and an unknown first segment makes the click do nothing */
        href: `custom/${id}`,
        vars: {
          project_title: String(project.title ?? "project"),
          customer_email: ctx.ownerEmail,
        },
      });
    } catch (e) {
      console.error("[brief] alert failed:", (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true });
}
