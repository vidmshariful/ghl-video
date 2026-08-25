import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { addFile, listFiles, removeFile, type FileOwner } from "@/lib/project-files";

export const runtime = "nodejs";

/*
 * The studio's side of attachments: the same shared list the client sees,
 * whether the file hangs off a custom project or an editing request. We add a
 * reference or a source file for them, or clear one out, and it shows on both
 * sides at once.
 *
 * One route for both because it is one list with one set of rules. The caller
 * says which by passing projectId or deliverableId.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whichever of the two the caller named, or null if neither is usable. */
function ownerFrom(get: (k: string) => string | null): FileOwner | null {
  const projectId = get("projectId") ?? "";
  if (UUID_RE.test(projectId)) return { projectId };
  const deliverableId = get("deliverableId") ?? "";
  if (UUID_RE.test(deliverableId)) return { deliverableId };
  return null;
}

async function nameOf(db: ReturnType<typeof supabaseAdmin>, email: string): Promise<string | null> {
  const { data } = await db.from("admins").select("name").ilike("email", email).maybeSingle();
  return (data?.name as string | null) ?? null;
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const owner = ownerFrom((k) => url.searchParams.get(k));
  if (!owner) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  return NextResponse.json({ files: await listFiles(supabaseAdmin(), owner) });
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
  const owner = ownerFrom((k) => (form.get(k) as string | null) ?? null);
  if (!owner) return NextResponse.json({ error: "Which one?" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const db = supabaseAdmin();
  const res = await addFile(db, {
    owner,
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
  const owner = ownerFrom((k) => url.searchParams.get(k));
  const fileId = url.searchParams.get("fileId") ?? "";
  if (!owner) return NextResponse.json({ error: "Which one?" }, { status: 400 });
  if (!fileId) return NextResponse.json({ error: "Which file?" }, { status: 400 });

  const ok = await removeFile(supabaseAdmin(), { id: fileId, owner });
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
