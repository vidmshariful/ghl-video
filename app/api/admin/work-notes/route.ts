import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * Team notes on one work item. Admin-gated at the route AND admin-only at
 * the table's RLS: the portal has no code path to these on purpose, because
 * "waiting on their logo, chase Tuesday" is coordination, not conversation.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function owner(url: URL): { col: "deliverable_id" | "project_id"; id: string } | null {
  const d = url.searchParams.get("deliverableId");
  const p = url.searchParams.get("projectId");
  if (d && UUID_RE.test(d)) return { col: "deliverable_id", id: d };
  if (p && UUID_RE.test(p)) return { col: "project_id", id: p };
  return null;
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const who = owner(new URL(req.url));
  if (!who) return NextResponse.json({ error: "Which item?" }, { status: 400 });

  const { data } = await supabaseAdmin()
    .from("work_notes")
    .select("id, author, body, created_at")
    .eq(who.col, who.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    notes: ((data ?? []) as Record<string, unknown>[]).map((n) => ({
      id: String(n.id),
      author: String(n.author),
      body: String(n.body),
      at: String(n.created_at),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!body) return NextResponse.json({ error: "Write the note first." }, { status: 400 });

  const insert: Record<string, unknown> = { author: admin.email, body };
  if (typeof b.deliverableId === "string" && UUID_RE.test(b.deliverableId))
    insert.deliverable_id = b.deliverableId;
  else if (typeof b.projectId === "string" && UUID_RE.test(b.projectId))
    insert.project_id = b.projectId;
  else return NextResponse.json({ error: "Which item?" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("work_notes")
    .insert(insert)
    .select("id, author, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    ok: true,
    note: { id: String(data.id), author: String(data.author), body: String(data.body), at: String(data.created_at) },
  });
}
