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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("quote lead sync failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Something went wrong sending your request. Please email hi@ghlvideo.com and we'll jump on it." },
      { status: 502 },
    );
  }
}
