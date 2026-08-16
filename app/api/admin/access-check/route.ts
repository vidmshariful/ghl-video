import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";

export const runtime = "nodejs";

/*
 * Is the region bypass actually configured on the deployment that is running?
 *
 * The team key was added in the hosting settings and still did not work, and
 * from the outside a wrong value and a missing variable look identical: both
 * are a 403. This says which, without ever returning a key.
 *
 * Counts and shapes only. No values, no prefixes, nothing that helps somebody
 * guess a key, and admin-gated on top. The one thing it will confirm about a
 * specific key is whether it would be accepted, which is something anybody can
 * already find out by pasting it into the unlock link.
 */
function keys(): string[] {
  return [process.env.ACCESS_BYPASS_KEY, ...(process.env.ACCESS_BYPASS_KEYS ?? "").split(",")]
    .map((k) => (k ?? "").trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const raw = process.env.ACCESS_BYPASS_KEYS ?? "";
  const owner = process.env.ACCESS_BYPASS_KEY ?? "";
  const all = keys();

  const url = new URL(req.url);
  const test = url.searchParams.get("test");

  return NextResponse.json({
    ownerKeySet: Boolean(owner.trim()),
    // the thing we are actually chasing: does this deployment see the variable
    teamKeysVariableSet: raw.length > 0,
    teamKeysCount: raw.split(",").map((k) => k.trim()).filter(Boolean).length,
    totalKeysAccepted: all.length,
    /* A value that arrived wrapped in quotes or with a stray space is the most
     * common way this fails, and it is invisible in a hosting dashboard. */
    looksQuoted: /^["']|["']$/.test(raw.trim()),
    hasSurroundingSpace: raw !== raw.trim(),
    blockedCountries: (process.env.BLOCKED_COUNTRIES ?? "BD,PK").split(",").map((c) => c.trim()),
    ...(test ? { thatKeyWouldWork: all.includes(test.trim()) } : {}),
  });
}
