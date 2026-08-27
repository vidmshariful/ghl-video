import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ONLINE_MS, collapseVisits } from "@/lib/portal-activity";

export const runtime = "nodejs";

/*
 * Who is in this client's portal, and who has been.
 *
 * `online` is a judgement, not a stored flag, and the windows it is judged
 * against are shared with the writer so the log and the screen cannot drift
 * apart. See lib/portal-activity.
 */

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
    /* collapsed, because the rows written before the writer learned to skip
       repeats hold one line per token refresh rather than one per visit */
    events: collapseVisits(
      (events ?? []).map((e) => ({
        id: String(e.id),
        email: String(e.actor_email),
        kind: String(e.kind) as "signed_in" | "signed_out",
        at: e.at as string,
      })),
    ),
  });
}
