import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { findPriceDrift } from "@/lib/checkout/price-drift";
import { ALARM_KINDS, raise } from "@/lib/alarm";

export const runtime = "nodejs";
/* Never cached: the whole point is asking the database what is true now. */
export const dynamic = "force-dynamic";

/*
 * Every morning: does the site still charge what it says it charges?
 *
 * Prices live in lib/site.ts, but checkout charges the products table, and the
 * two only agree after somebody presses "Sync from catalog". Change a price,
 * deploy, forget the sync, and the site quietly sells at the old price. The
 * check for this already existed and was never the problem; remembering to
 * run it was. So now nobody has to.
 *
 * Resolving is automatic and deliberate. Drift is fixed by pressing Sync in
 * the admin, and asking somebody to then come back here and tick the alarm off
 * is how an alarm list fills with things that stopped being true. If the next
 * run finds nothing, the alarm closes itself.
 */
export async function GET(req: Request) {
  /*
   * Vercel signs its cron calls with CRON_SECRET. The guard only engages when
   * the secret is set, so the endpoint keeps working before somebody adds it
   * (the worst case being that a stranger can make us compare our own prices,
   * which reads nothing they could not already see on the pricing page).
   */
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const db = supabaseAdmin();

  let report;
  try {
    report = await findPriceDrift(db);
  } catch (e) {
    /* The check itself failing is worth knowing about: it means we have
     * stopped watching, which looks exactly like nothing being wrong. */
    await raise(db, {
      kind: ALARM_KINDS.DRIFT_CHECK_FAILED,
      fingerprint: ALARM_KINDS.DRIFT_CHECK_FAILED,
      message: `The daily price check could not run: ${e instanceof Error ? e.message : String(e)}`,
      notifyAfter: 2,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  if (report.problems.length) {
    await raise(db, {
      kind: ALARM_KINDS.PRICE_DRIFT,
      fingerprint: ALARM_KINDS.PRICE_DRIFT,
      severity: "critical",
      message: `${report.problems.length} product(s) are priced differently in the site than in checkout, so a buyer could be charged the wrong amount. Open admin, then Products, and press "Sync from catalog".`,
      context: {
        /* capped: the alarm is a prompt to press Sync, not a report to read,
           and a hundred lines of detail in an email helps nobody */
        first: report.problems.slice(0, 5).join(" | "),
        total: report.problems.length,
      },
    });
    return NextResponse.json({ ok: true, drift: report.problems.length });
  }

  /* Clean. Close anything this check opened earlier. */
  await db
    .from("alarms")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: "the daily price check",
      notified_at: null,
    })
    .in("fingerprint", [ALARM_KINDS.PRICE_DRIFT, ALARM_KINDS.DRIFT_CHECK_FAILED])
    .is("resolved_at", null);

  return NextResponse.json({
    ok: true,
    drift: 0,
    checked: report.checkedProducts + report.checkedBundles,
  });
}
