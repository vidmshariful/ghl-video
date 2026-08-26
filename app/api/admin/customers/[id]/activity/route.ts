import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * Who is in this client's portal, and who has been.
 *
 * `online` is a judgement, not a stored flag: presence rows are refreshed
 * every 45 seconds by an open tab, so anything seen inside two minutes is
 * still there and anything older is a tab that was closed or a laptop that
 * went to sleep. Two minutes rather than one because a missed beat on a slow
 * connection should not blink somebody offline.
 */
const ONLINE_MS = 2 * 60 * 1000;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const { id } = await params;
  const { data: customer } = await db
    .from("customers")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!customer?.email) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const account = String(customer.email).toLowerCase();

  const [{ data: presence }, { data: events }] = await Promise.all([
    db
      .from("portal_presence")
      .select("actor_email, last_seen_at")
      .eq("account_email", account)
      .order("last_seen_at", { ascending: false }),
    db
      .from("portal_activity")
      .select("id, actor_email, kind, at")
      .eq("account_email", account)
      .order("at", { ascending: false })
      .limit(60),
  ]);

  const now = Date.now();
  return NextResponse.json({
    /* everyone with a presence row, whether or not they are still in */
    people: (presence ?? []).map((p) => ({
      email: String(p.actor_email),
      lastSeenAt: p.last_seen_at as string,
      online: now - Date.parse(p.last_seen_at as string) < ONLINE_MS,
    })),
    events: (events ?? []).map((e) => ({
      id: String(e.id),
      email: String(e.actor_email),
      kind: String(e.kind) as "signed_in" | "signed_out",
      at: e.at as string,
    })),
  });
}
