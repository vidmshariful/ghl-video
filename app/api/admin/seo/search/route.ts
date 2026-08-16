import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { googleConnection } from "@/lib/google/auth";
import { searchSummary } from "@/lib/google/search-console";

export const runtime = "nodejs";

/* No maxDuration override on purpose (see the audit route): a value above
 * the plan's ceiling fails the deploy. These are four small parallel calls. */

/* What the SEO screen's Search tab reads: one call, one period against the
 * one before it. Returns a plain "not connected yet" rather than an error so
 * the screen can show the setup steps instead of a red box. */
export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const connection = await googleConnection();
  if (!connection.connected) return NextResponse.json({ state: "not-connected" });
  if (!connection.property) return NextResponse.json({ state: "no-property", connection });

  const days = Number(new URL(req.url).searchParams.get("days")) || 28;
  try {
    const summary = await searchSummary([7, 28, 90].includes(days) ? days : 28);
    return NextResponse.json({ state: "ok", connection, summary, days });
  } catch (e) {
    return NextResponse.json({ state: "error", connection, error: (e as Error).message });
  }
}
