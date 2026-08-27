import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * The people at one client.
 *
 * Only one may be primary, enforced by a partial unique index rather than by
 * hoping the UI behaves, so "who is in charge here" always has exactly one
 * answer. Promoting somebody therefore has to demote whoever held it, which
 * is done here rather than left to fail as a constraint violation the person
 * clicking would not understand.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = ["primary", "production", "billing", "other"] as const;
type Role = (typeof ROLES)[number];

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(b.name, 160);
  if (!name) return NextResponse.json({ error: "Who is it?" }, { status: 400 });
  const role: Role = ROLES.includes(b.role as Role) ? (b.role as Role) : "other";

  const db = supabaseAdmin();
  if (role === "primary") {
    /* one primary per client: step the current one down first */
    await db
      .from("customer_contacts")
      .update({ role: "other" })
      .eq("customer_id", id)
      .eq("role", "primary");
  }

  /* returning the row, so the record can add it to the list without
     re-downloading the whole customer to see one contact it just typed */
  const { data: created, error } = await db
    .from("customer_contacts")
    .insert({
      customer_id: id,
      name,
      email: str(b.email, 200)?.toLowerCase() ?? null,
      phone: str(b.phone, 40),
      title: str(b.title, 120),
      notes: str(b.notes, 2000),
      role,
    })
    .select("id, name, email, phone, title, role")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, contact: created });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const contactId = str(b.contactId, 64);
  if (!UUID_RE.test(id) || !contactId || !UUID_RE.test(contactId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const db = supabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (ROLES.includes(b.role as Role)) {
    if (b.role === "primary") {
      await db
        .from("customer_contacts")
        .update({ role: "other" })
        .eq("customer_id", id)
        .eq("role", "primary")
        .neq("id", contactId);
    }
    patch.role = b.role;
  }
  for (const [key, col, max] of [
    ["name", "name", 160],
    ["email", "email", 200],
    ["phone", "phone", 40],
    ["title", "title", 120],
    ["notes", "notes", 2000],
  ] as const) {
    if (key in b) patch[col] = str(b[key], max);
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db
    .from("customer_contacts")
    .update(patch)
    .eq("id", contactId)
    .eq("customer_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const contactId = new URL(req.url).searchParams.get("contactId") ?? "";
  if (!UUID_RE.test(id) || !UUID_RE.test(contactId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { error } = await supabaseAdmin()
    .from("customer_contacts")
    .delete()
    .eq("id", contactId)
    .eq("customer_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
