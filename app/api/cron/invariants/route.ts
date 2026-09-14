import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { runInvariants, invariantMessage } from "@/lib/invariants";
import { raise } from "@/lib/alarm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * The nightly invariant check. Every fact the platform must never
 * contradict, read against the live rows, and an alarm on the Health
 * screen for each one that is false. Read-only apart from the alarms.
 *
 * Like the chase cron: Vercel presents CRON_SECRET, or a signed-in admin
 * runs it by hand from the Health screen. No secret and no admin means no
 * run.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const signed = Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!signed && !(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  try {
    const results = await runInvariants(db);
    const failing = results.filter((r) => r.count > 0);
    for (const r of failing) {
      await raise(db, {
        kind: `invariant.${r.key}`,
        severity: r.severity === "error" ? "error" : "warn",
        message: invariantMessage(r),
        fingerprint: `invariant:${r.key}`,
        context: { count: r.count, sample: r.sample },
      });
    }
    return NextResponse.json({
      ok: true,
      checked: results.length,
      failing: failing.map((r) => ({ key: r.key, severity: r.severity, count: r.count, sample: r.sample })),
    });
  } catch (e) {
    /* the check itself failing looks exactly like nothing being wrong, so it
       gets a bell of its own (audit, 15 September 2026) */
    const message = e instanceof Error ? e.message : String(e);
    await raise(db, {
      kind: "cron.failed",
      fingerprint: "cron:invariants",
      notifyAfter: 2,
      message: `The nightly invariant check could not run: ${message}`,
      context: { route: "invariants", error: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
