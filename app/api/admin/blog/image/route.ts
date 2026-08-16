import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/* Upload one blog image (cover or in-article) to the public blog bucket.
 * Admin-gated; the bucket has no client policies, so this route is the only
 * write path. Returns the public URL the editor embeds. */
export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Attach an image file." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext)
    return NextResponse.json({ error: "Use a PNG, JPG, WebP, GIF, or SVG image." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });

  const db = supabaseAdmin();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage
    .from("blog")
    .upload(name, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "31536000",
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = db.storage.from("blog").getPublicUrl(name);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
