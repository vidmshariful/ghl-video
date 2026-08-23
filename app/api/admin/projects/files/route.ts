import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { addProjectFile, listProjectFiles, removeProjectFile } from "@/lib/project-files";

export const runtime = "nodejs";

/*
 * The studio's side of a project's attachments: the same shared list the
 * client sees on their project page. We add a reference or a source file for
 * them, or clear one out, and it shows on both sides at once.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function nameOf(db: ReturnType<typeof supabaseAdmin>, email: string): Promise<string | null> {
  const { data } = await db.from("admins").select("name").ilike("email", email).maybeSingle();
  return (data?.name as string | null) ?? null;
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: "Which project?" }, { status: 400 });

  return NextResponse.json({ files: await listProjectFiles(supabaseAdmin(), projectId) });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const projectId = String(form.get("projectId") ?? "");
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: "Which project?" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const db = supabaseAdmin();
  const res = await addProjectFile(db, {
    projectId,
    file,
    side: "studio",
    email: admin.email,
    name: (await nameOf(db, admin.email)) ?? "GHL Video",
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const fileId = url.searchParams.get("fileId") ?? "";
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: "Which project?" }, { status: 400 });
  if (!fileId) return NextResponse.json({ error: "Which file?" }, { status: 400 });

  const ok = await removeProjectFile(supabaseAdmin(), { id: fileId, projectId });
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
