import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { pushAdminNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * A signed-in customer asking for their first custom project, straight
 * from the portal's Custom page. Lands in the same enquiries list the
 * website's quote form feeds, tagged with its source, so the pipeline for
 * closing it is the one that already exists: talk, agree, create the
 * project, invoice.
 */

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const format = typeof b.format === "string" ? b.format.trim().slice(0, 80) : "";
  const brief = typeof b.brief === "string" ? b.brief.trim().slice(0, 4000) : "";
  if (!brief)
    return NextResponse.json(
      { error: "Tell us what you want made, even roughly." },
      { status: 400 },
    );

  const email = ctx.ownerEmail.toLowerCase();
  const { data: customer } = await db
    .from("customers")
    .select("name, company")
    .ilike("email", email)
    .maybeSingle();

  const { error } = await db.from("project_requests").insert({
    name: (customer?.name as string | null) ?? null,
    email,
    company: (customer?.company as string | null) ?? null,
    brief: format ? `[${format}] ${brief}` : brief,
    source: "portal",
    status: "new",
  });
  if (error) return NextResponse.json({ error: "Could not send that. Try again." }, { status: 500 });

  await pushAdminNotifications(db, {
    kind: "project_request",
    title: `Custom enquiry from ${customer?.company ?? customer?.name ?? email}`,
    body: `${format ? format + ": " : ""}${brief.slice(0, 140)}`,
    href: "custom",
    vars: {
      customer: String(customer?.company ?? customer?.name ?? email),
      summary: `${format ? format + ": " : ""}${brief.slice(0, 140)}`,
    },
  });

  return NextResponse.json({ ok: true });
}
