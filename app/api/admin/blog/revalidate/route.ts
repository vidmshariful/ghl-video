import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/checkout/admin-auth";

export const runtime = "nodejs";

/* Refresh the public blog pages after a save or publish, so edits show up
 * immediately instead of waiting out the pages' revalidate window. */
export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  if (typeof body.slug === "string" && body.slug) {
    revalidatePath(`/blog/${body.slug}`);
  }
  // category pages are few; refresh them all
  revalidatePath("/blog/category/[slug]", "page");
  return NextResponse.json({ ok: true });
}
