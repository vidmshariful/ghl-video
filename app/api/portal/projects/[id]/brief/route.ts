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
    .select("id")
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
  return NextResponse.json({ ok: true });
}
