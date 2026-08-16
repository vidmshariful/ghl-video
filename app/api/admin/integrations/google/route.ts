import { NextResponse } from "next/server";
import { verifyAdmin, adminRole } from "@/lib/checkout/admin-auth";
import {
  disconnectGoogle,
  googleConnection,
  parseServiceAccount,
  saveGoogleAccount,
  setGoogleTargets,
} from "@/lib/google/auth";
import { listProperties } from "@/lib/google/search-console";

export const runtime = "nodejs";

/*
 * Connect Google to the platform: the admin pastes the service account key
 * file here and it is stored where only server code can read it. The key is
 * never sent back to the browser; the screen only ever learns which account
 * is connected and which properties it can see.
 *
 * Admin role only, like the Team and Integrations screens: this credential
 * reads the company's search data.
 */

async function gate(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if ((await adminRole(admin.email)) !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Only an Admin can change connected services." },
        { status: 403 },
      ),
    };
  }
  return { admin };
}

export async function GET(req: Request) {
  const g = await gate(req);
  if (g.error) return g.error;

  const connection = await googleConnection();
  if (!connection.connected) return NextResponse.json({ connection, properties: [] });

  /* Listing properties is also the live proof the key works, so the screen
   * can say "connected and reading" rather than "saved". */
  try {
    const properties = await listProperties();
    return NextResponse.json({ connection, properties });
  } catch (e) {
    return NextResponse.json({
      connection: { ...connection, lastError: (e as Error).message },
      properties: [],
    });
  }
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (g.error) return g.error;

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const parsed = parseServiceAccount(body.key ?? "");
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await saveGoogleAccount(parsed.account, g.admin!.email);

  /* Verify immediately: a key that saves but cannot read is a trap that only
   * surfaces days later. */
  try {
    const properties = await listProperties();
    return NextResponse.json({
      ok: true,
      connection: await googleConnection(),
      properties,
      notice:
        properties.length === 0
          ? `The key works, but this account cannot see any property yet. In Search Console add ${parsed.account.client_email} under Settings, Users and permissions.`
          : null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      connection: await googleConnection(),
      properties: [],
      notice: (e as Error).message,
    });
  }
}

/** Choose which Search Console property (and later GA property) to read. */
export async function PATCH(req: Request) {
  const g = await gate(req);
  if (g.error) return g.error;

  const body = (await req.json().catch(() => ({}))) as {
    property?: string | null;
    gaPropertyId?: string | null;
  };
  const patch: { property?: string | null; gaPropertyId?: string | null } = {};
  if (typeof body.property === "string" || body.property === null) patch.property = body.property;
  if (typeof body.gaPropertyId === "string" || body.gaPropertyId === null) {
    patch.gaPropertyId = (body.gaPropertyId ?? "").toString().trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  await setGoogleTargets(patch);
  return NextResponse.json({ ok: true, connection: await googleConnection() });
}

export async function DELETE(req: Request) {
  const g = await gate(req);
  if (g.error) return g.error;
  await disconnectGoogle();
  return NextResponse.json({ ok: true });
}
