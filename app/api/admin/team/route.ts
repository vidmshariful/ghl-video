import { NextResponse } from "next/server";
import { verifyAdmin, adminRole } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ensureAuthAccount } from "@/lib/checkout/account";

export const runtime = "nodejs";

/*
 * Team management for the admin allowlist. Every method is gated to the
 * 'admin' role (not just any admin), so a manager or sales rep cannot add
 * teammates or escalate their own access by calling the API directly. Adding
 * a teammate creates their Supabase login (no password); they set one via
 * the reset link on the admin sign-in page.
 */
const ROLES = ["admin", "manager", "sales_rep"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Gate = { email: string } | { error: NextResponse };

async function requireAdminRole(req: Request): Promise<Gate> {
  const auth = await verifyAdmin(req);
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = await adminRole(auth.email);
  if (role !== "admin")
    return { error: NextResponse.json({ error: "Only admins can manage the team." }, { status: 403 }) };
  return { email: auth.email };
}

/* array of strings -> cleaned features; null stays null; anything else -> undefined */
function parseFeatures(v: unknown): string[] | null | undefined {
  if (Array.isArray(v)) return v.filter((f) => typeof f === "string") as string[];
  if (v === null) return null;
  return undefined;
}

export async function GET(req: Request) {
  const gate = await requireAdminRole(req);
  if ("error" in gate) return gate.error;
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("email, name, role, features, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdminRole(req);
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const features = parseFeatures(body.features);

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });

  // create their login (idempotent; no password, they set it via the reset link)
  await ensureAuthAccount(email);

  const { error } = await supabaseAdmin()
    .from("admins")
    .insert({ email, name, role, features: role === "admin" ? null : features ?? null });
  if (error) {
    if (error.code === "23505")
      return NextResponse.json({ error: "That email is already on the team." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminRole(req);
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const features = parseFeatures(body.features);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  if (role && !ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  // never leave zero admins
  if (role && role !== "admin") {
    const { data } = await supabaseAdmin().from("admins").select("email, role");
    const admins = (data ?? []).filter((r) => r.role === "admin");
    if (admins.length === 1 && (admins[0].email ?? "").toLowerCase() === email)
      return NextResponse.json({ error: "You cannot demote the last admin." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (role) patch.role = role;
  if (role === "admin") patch.features = null;
  else if (features !== undefined) patch.features = features;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin().from("admins").update(patch).eq("email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminRole(req);
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  if (email === gate.email.toLowerCase())
    return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });

  const { data } = await supabaseAdmin().from("admins").select("email, role");
  const target = (data ?? []).find((r) => (r.email ?? "").toLowerCase() === email);
  if (!target) return NextResponse.json({ error: "That teammate was not found." }, { status: 404 });
  const admins = (data ?? []).filter((r) => r.role === "admin");
  if (target.role === "admin" && admins.length <= 1)
    return NextResponse.json({ error: "You cannot remove the last admin." }, { status: 400 });

  const { error } = await supabaseAdmin().from("admins").delete().eq("email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
