import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { googleConnection } from "@/lib/google/auth";
import { gaSummary } from "@/lib/google/analytics";

export const runtime = "nodejs";

/* What the SEO screen's Traffic tab reads: Analytics for one period against
 * the one before it. Like the Search route, it returns a plain state rather
 * than an error so the screen can show the next step instead of a red box. */
export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const connection = await googleConnection();
  if (!connection.connected) return NextResponse.json({ state: "not-connected" });
  if (!connection.gaPropertyId) return NextResponse.json({ state: "no-property", connection });

  const days = Number(new URL(req.url).searchParams.get("days")) || 28;
  try {
    const summary = await gaSummary([7, 28, 90].includes(days) ? days : 28);
    return NextResponse.json({ state: "ok", connection, summary, days });
  } catch (e) {
    return NextResponse.json({ state: "error", connection, error: (e as Error).message });
  }
}
