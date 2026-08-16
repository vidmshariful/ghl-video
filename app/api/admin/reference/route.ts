import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * The quick reference: things the team needs often, in one place.
 *
 * A secret's value never travels with the list. It is fetched one at a time,
 * by id, because the admin gets screenshotted and a screen full of visible
 * keys is exactly how one leaks. Everything else comes back with the list, so
 * an ordinary link is still one click to copy.
 */

const MAX_VALUE = 8000;

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const reveal = new URL(req.url).searchParams.get("reveal");

  // one secret, on request
  if (reveal) {
    const { data } = await db
      .from("reference_items")
      .select("id, value")
      .eq("id", reveal)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ id: data.id, value: data.value });
  }

  const { data } = await db
    .from("reference_items")
    .select("*")
    .order("category")
    .order("sort")
    .order("label");

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      label: r.label as string,
      note: (r.note as string | null) ?? null,
      category: r.category as string,
      secret: Boolean(r.secret),
      // withheld on purpose; the reveal endpoint hands it over one at a time
      value: r.secret ? null : (r.value as string),
      updatedAt: r.updated_at as string,
    })),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const label = typeof b.label === "string" ? b.label.trim() : "";
  const value = typeof b.value === "string" ? b.value : "";
  if (!label) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  if (!value.trim()) return NextResponse.json({ error: "Give it a value." }, { status: 400 });
  if (value.length > MAX_VALUE)
    return NextResponse.json({ error: "That value is too long." }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("reference_items").insert({
    label,
    value,
    note: typeof b.note === "string" ? b.note.trim() || null : null,
    category: typeof b.category === "string" && b.category.trim() ? b.category.trim() : "General",
    secret: b.secret === true,
    created_by: admin.email,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.label === "string") {
    if (!b.label.trim()) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
    patch.label = b.label.trim();
  }
  /* An empty string is a real edit elsewhere, but here it would silently wipe
   * the thing somebody came to copy, so it is refused rather than saved. */
  if (typeof b.value === "string") {
    if (!b.value.trim()) return NextResponse.json({ error: "Give it a value." }, { status: 400 });
    if (b.value.length > MAX_VALUE)
      return NextResponse.json({ error: "That value is too long." }, { status: 400 });
    patch.value = b.value;
  }
  if (typeof b.note === "string") patch.note = b.note.trim() || null;
  if (typeof b.category === "string" && b.category.trim()) patch.category = b.category.trim();
  if (typeof b.secret === "boolean") patch.secret = b.secret;

  const db = supabaseAdmin();
  const { error } = await db.from("reference_items").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("reference_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
