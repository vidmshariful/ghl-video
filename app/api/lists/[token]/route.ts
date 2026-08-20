import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolveList } from "@/lib/shared-lists";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * A shared list, read by whoever holds the link.
 *
 * No account, on purpose. The person this is for is a cofounder or a
 * marketing lead who has never visited the site, and making them sign up to
 * look at six thumbnails is exactly the wall the idea exists to remove.
 *
 * The token is the whole permission, so the row it unlocks carries nothing
 * that would matter if the link were forwarded: what was picked, what it
 * costs, and a first name.
 */

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const db = supabaseAdmin();
  const list = await resolveList(db, token);
  if (!list) return NextResponse.json({ error: "Not found." }, { status: 404 });

  /* Count the open, best effort. Whether a shared list was ever looked at is
   * the only thing that tells us whether this feature works, and a failure
   * to count must never stop somebody reading their list. */
  try {
    const { data: current } = await db
      .from("shared_lists")
      .select("opened_count")
      .eq("token", token)
      .maybeSingle();
    await db
      .from("shared_lists")
      .update({
        opened_count: Number(current?.opened_count ?? 0) + 1,
        last_opened_at: new Date().toISOString(),
      })
      .eq("token", token);
  } catch {
    /* counting is not the job */
  }

  return NextResponse.json({ list });
}

/*
 * "Ask us to invoice these."
 *
 * The way out of a list that is not six separate card payments. At these
 * prices the buyer is usually a company, the company runs it through
 * finance, and finance does not use a personal card. So the reply we want is
 * an invoice for the set, which is machinery we already have.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const rl = rateLimit(`list:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );

  const { token } = await params;
  if (!UUID_RE.test(token)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const db = supabaseAdmin();
  const list = await resolveList(db, token);
  if (!list) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!list.items.length)
    return NextResponse.json({ error: "There is nothing on this list." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const company = String(b.company ?? "").trim().slice(0, 160);
  const message = String(b.message ?? "").trim().slice(0, 1000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "A working email address, please." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Your name, please." }, { status: 400 });

  await db.from("shared_lists").update({ requested_at: new Date().toISOString() }).eq("token", token);

  const lines = list.items
    .map((i) => `- ${i.title} (${i.code.toUpperCase()}), ${(i.priceCents / 100).toFixed(0)} USD`)
    .join("\n");
  const brief = [
    `Invoice requested from a shared list: ${list.title}`,
    company ? `Company: ${company}` : null,
    "",
    lines,
    "",
    `Total: ${(list.totalCents / 100).toLocaleString("en-US")} USD`,
    message ? `\nThey said: ${message}` : null,
    `\nThe list: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ghlvideo.com"}/list/${token}/`,
  ]
    .filter(Boolean)
    .join("\n");

  /* the same lead path the website quote form uses, so this lands where the
   * team already looks rather than in a place built for one feature */
  try {
    const { syncLeadToHighLevel } = await import("@/lib/checkout/highlevel");
    await syncLeadToHighLevel({
      email,
      name,
      company,
      tags: ["website-quote-request", "shared-list"],
      note: brief,
      opportunityName: `Shared list: ${list.title}`,
    });
  } catch (e) {
    console.error("[list] lead not synced:", e instanceof Error ? e.message : e);
  }

  try {
    const { pushAdminNotifications } = await import("@/lib/notifications");
    await pushAdminNotifications(db, {
      kind: "list_invoice_requested",
      title: `Invoice asked for: ${list.title}`,
      body: `${name} at ${email}, ${list.items.length} videos, ${(list.totalCents / 100).toLocaleString("en-US")} USD.`,
      href: "/admin/invoices/",
    });
  } catch {
    /* a notification failing must never fail the request */
  }

  return NextResponse.json({ ok: true });
}
