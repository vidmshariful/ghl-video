import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext, actorName } from "@/lib/account-team";
import { addProjectFile, listProjectFiles, removeProjectFile } from "@/lib/project-files";

export const runtime = "nodejs";

/*
 * The client's side of a project's attachments.
 *
 * They upload what we asked them for and delete what they no longer want here;
 * the studio does the same from admin. Both write to the one shared list on
 * the project, so a file added on either side shows on both. Every call is
 * gated on the caller actually owning this project.
 */

async function guard(req: Request, id: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "orders"))
    return { fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };

  const { data: project } = await db
    .from("projects")
    .select("id, customer_email")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  /* whoever is uploading, not whoever owns the account */
  return { db, ctx, name: await actorName(db, ctx) };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;
  return NextResponse.json({ files: await listProjectFiles(g.db, id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const res = await addProjectFile(g.db, {
    projectId: id,
    file,
    side: "client",
    email: g.ctx.selfEmail,
    name: g.name,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const fileId = new URL(req.url).searchParams.get("fileId") ?? "";
  if (!fileId) return NextResponse.json({ error: "Which file?" }, { status: 400 });

  const ok = await removeProjectFile(g.db, { id: fileId, projectId: id });
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
