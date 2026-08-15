import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

/* The admin bell: latest notifications + unread count, and mark-as-read. */
export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await listNotifications(supabaseAdmin(), "admin", auth.email);
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v: unknown): v is string => typeof v === "string")
    : undefined;
  await markNotificationsRead(supabaseAdmin(), "admin", auth.email, ids);
  return NextResponse.json({ ok: true });
}
