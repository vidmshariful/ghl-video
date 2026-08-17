import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { humanKind } from "@/lib/alarm";

export const runtime = "nodejs";

/*
 * What is broken, and what was broken.
 *
 * Open alarms come first and in full. Resolved ones are capped, because the
 * point of this screen is the short list of things needing attention and a
 * long history underneath it would bury that.
 */

const RESOLVED_LIMIT = 30;

type Row = Record<string, unknown>;

const shape = (r: Row) => ({
  id: r.id as string,
  kind: r.kind as string,
  /* the slug is for us, this is for the person reading the screen */
  title: humanKind(r.kind as string),
  severity: r.severity as string,
  message: r.message as string,
  context: (r.context ?? {}) as Record<string, unknown>,
  count: Number(r.count ?? 1),
  firstSeenAt: r.first_seen_at as string,
  lastSeenAt: r.last_seen_at as string,
  resolvedAt: (r.resolved_at as string | null) ?? null,
  resolvedBy: (r.resolved_by as string | null) ?? null,
});

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();

  const [openRes, doneRes] = await Promise.all([
    db
      .from("alarms")
      .select("*")
      .is("resolved_at", null)
      .order("last_seen_at", { ascending: false }),
    db
      .from("alarms")
      .select("*")
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(RESOLVED_LIMIT),
  ]);

  if (openRes.error) {
    return NextResponse.json({ error: openRes.error.message }, { status: 500 });
  }

  const open = (openRes.data ?? []).map(shape);
  return NextResponse.json({
    open,
    resolved: (doneRes.data ?? []).map(shape),
    /* the badge in the sidebar, so trouble is visible without opening this */
    criticalCount: open.filter((a) => a.severity === "critical").length,
  });
}

/*
 * Fire a harmless alarm at yourself.
 *
 * Monitoring nobody has ever seen fire is monitoring nobody trusts, and the
 * first time this system speaks should not be the night a real payment goes
 * missing. This runs the genuine raise() path, so what arrives is exactly
 * what a real alarm would look like: the bell, the email, and a line on this
 * screen that you clear the same way.
 *
 * Deliberately not a mock. A test that takes a different path than the real
 * thing proves the test works, which is not the question being asked.
 */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const { ALARM_KINDS, raise } = await import("@/lib/alarm");

  await raise(db, {
    kind: ALARM_KINDS.TEST,
    fingerprint: `${ALARM_KINDS.TEST}:${admin.email}`,
    severity: "critical",
    message:
      "This is a test, and nothing is wrong. It was sent from the Health screen so you can see what a real alarm looks like. Mark it handled to clear it.",
    context: { requestedBy: admin.email },
  });

  return NextResponse.json({ ok: true });
}

/** Mark one handled. It re-opens by itself if the same thing happens again. */
export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  const db = supabaseAdmin();
  const reopen = b.reopen === true;

  const { error } = await db
    .from("alarms")
    .update(
      reopen
        ? { resolved_at: null, resolved_by: null }
        : {
            resolved_at: new Date().toISOString(),
            resolved_by: admin.email,
            /* cleared so a recurrence is announced rather than throttled
               against a notification from before it was resolved */
            notified_at: null,
          },
    )
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
