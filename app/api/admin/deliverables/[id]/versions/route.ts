import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { listVersions } from "@/lib/versions";

export const runtime = "nodejs";

/*
 * Every cut one video has had, addressed by the VIDEO.
 *
 * The order board reads its cuts through the order route and the custom
 * projects room through the project one. Plan work belongs to a billing cycle
 * and has neither, which is the same gap that hid client feedback on plan
 * videos until last week: everything here is addressed by an owner the work
 * does not always have.
 *
 * Read only. Removing a cut already exists on the order board and is not
 * worth a second way to do it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();
  const { data: d } = await db
    .from("order_deliverables")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!d) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const versions = await listVersions(db, id);
  return NextResponse.json({
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      videoUrl: v.video_url,
      note: v.note,
      createdAt: v.created_at,
    })),
  });
}
