import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionEmail } from "@/lib/account/session";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

/* The customer bell: latest notifications + unread count, and mark-as-read. */
export async function GET(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await listNotifications(supabaseAdmin(), "customer", email);
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const email = await getSessionEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v: unknown): v is string => typeof v === "string")
    : undefined;
  await markNotificationsRead(supabaseAdmin(), "customer", email, ids);
  return NextResponse.json({ ok: true });
}
