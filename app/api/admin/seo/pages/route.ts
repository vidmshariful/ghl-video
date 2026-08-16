import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { normalizePath } from "@/lib/seo";

export const runtime = "nodejs";

/*
 * Per-page title/description overrides (admin -> CMS -> SEO -> Pages).
 * Saving here reaches the live page within seconds: the row is written, the
 * cached override map is invalidated, and the page itself is revalidated.
 */

const MAX_TITLE = 200;
const MAX_DESC = 400;

/* Push the change out to the live site. revalidatePath re-renders the page
 * itself; the tag purge drops the cached override lookup those renders read,
 * so the new title is live rather than up to a cache window stale. Both are
 * best-effort: a save must never fail because a cache purge did. */
function refresh(path: string) {
  try {
    revalidateTag("seo-pages", "max");
  } catch {
    /* the override fetch still expires on its own short window */
  }
  try {
    revalidatePath(path);
    revalidatePath("/sitemap.xml");
  } catch {
    /* same */
  }
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabaseAdmin().from("seo_pages").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}

export async function PUT(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawPath = typeof body.path === "string" ? body.path : "";
  if (!rawPath.startsWith("/")) {
    return NextResponse.json({ error: "A page path is required." }, { status: 400 });
  }
  const path = normalizePath(rawPath);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const ogImage = typeof body.og_image === "string" ? body.og_image.trim() : "";

  if (title.length > MAX_TITLE)
    return NextResponse.json({ error: `Keep the title under ${MAX_TITLE} characters.` }, { status: 400 });
  if (description.length > MAX_DESC)
    return NextResponse.json({ error: `Keep the description under ${MAX_DESC} characters.` }, { status: 400 });
  if (ogImage && !/^(https?:\/\/|\/)/.test(ogImage))
    return NextResponse.json(
      { error: "The share image must be a full https:// URL or start with /." },
      { status: 400 },
    );

  const row = {
    path,
    title: title || null,
    description: description || null,
    og_image: ogImage || null,
    noindex: body.noindex === true,
    updated_at: new Date().toISOString(),
    updated_by: admin.email ?? null,
  };

  const { error } = await supabaseAdmin().from("seo_pages").upsert(row, { onConflict: "path" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  refresh(path);
  return NextResponse.json({ ok: true, page: row });
}

/* Remove the override so the page falls back to the title and description it
 * ships with in code. */
export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { path?: string };
  if (typeof body.path !== "string" || !body.path.startsWith("/")) {
    return NextResponse.json({ error: "A page path is required." }, { status: 400 });
  }
  const path = normalizePath(body.path);

  const { error } = await supabaseAdmin().from("seo_pages").delete().eq("path", path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  refresh(path);
  return NextResponse.json({ ok: true });
}
