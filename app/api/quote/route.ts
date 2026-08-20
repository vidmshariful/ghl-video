import { NextResponse } from "next/server";
import { syncLeadToHighLevel } from "@/lib/checkout/highlevel";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/*
 * Website quote-request lead capture. Creates/updates the HighLevel contact,
 * tags it `website-quote-request` (which fires the CRM lead workflows), attaches
 * the project brief as a note, and opens an opportunity in the setter pipeline.
 * Rate-limited per IP; validated server-side; never leaks HL internals.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`quote:${clientIp(req)}`, 5, 60_000); // 5/min per IP
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = s(body.name, 120);
  const email = s(body.email, 200).toLowerCase();
  const company = s(body.company, 160);
  const type = s(body.type, 120);
  const details = s(body.details, 4000);
  const phone = s(body.phone, 40);

  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!EMAIL_RE.test(email))
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!details)
    return NextResponse.json({ error: "Please tell us about the project." }, { status: 400 });

  const lines = ["Website quote request"];
  if (company) lines.push(`Company / SaaS: ${company}`);
  if (type) lines.push(`Video type: ${type}`);
  if (phone) lines.push(`Phone: ${phone}`);
  lines.push("", details);
  const note = lines.join("\n");

  /*
   * Keep the enquiry before doing anything that can fail.
   *
   * Until now a quote request went to HighLevel and into a confirmation
   * email, and nothing was written here, so there was no pipeline to work, no
   * history, and no way to know how many enquiries became jobs. Worse, when
   * the CRM sync threw, the enquiry was lost outright and the person got an
   * error asking them to email us instead.
   *
   * So it is recorded first and fail-soft: a database hiccup must not cost us
   * the lead either, which is why nothing here is awaited into the response
   * path beyond its own try.
   */
  const { supabaseAdmin: sbAdmin } = await import("@/lib/checkout/supabase-admin");
  const db = sbAdmin();
  try {
    await db.from("project_requests").insert({
      name: name || null,
      email,
      company: company || null,
      phone: phone || null,
      brief: [type ? `Video type: ${type}` : "", details].filter(Boolean).join("\n\n"),
      source: "website",
    });
  } catch (err) {
    console.error("quote request not stored:", (err as Error).message);
  }

  try {
    await syncLeadToHighLevel({
      email,
      name,
      phone: phone || undefined,
      company: company || undefined,
      tags: ["website-quote-request"],
      note,
      opportunityName: `Quote: ${company || name}`,
    });
    // confirmation to the lead; fail-soft, never blocks the response
    const { sendQuoteReceivedEmail } = await import("@/lib/email/notify");
    await sendQuoteReceivedEmail(db, email, name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("quote lead sync failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Something went wrong sending your request. Please email hi@ghlvideo.com and we'll jump on it." },
      { status: 502 },
    );
  }
}
