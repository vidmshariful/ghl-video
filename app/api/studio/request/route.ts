import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * Visitor video-topic requests from the /studio-insights board. Inserts
 * into the moderated studio_requests queue (the public can never read
 * that table; the team promotes topics onto the board from admin).
 * Rate-limited per IP and length-checked; the DB check constraint is
 * the backstop.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`studio-req:${clientIp(req)}`, 5, 60_000); // 5/min per IP
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

  const topic = String(body.topic ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (topic.length < 4) {
    return NextResponse.json(
      { error: "Tell us the topic in a few words." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin()
    .from("studio_requests")
    .insert({ topic });
  if (error) {
    console.error("studio request insert failed:", error.message);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
