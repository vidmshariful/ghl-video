import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * A reaction on a catalogue video, from anyone.
 *
 * love / unlove move the heart counter; play records a preview open. No
 * account, deliberately: the library is public and a heart behind a login
 * is a heart nobody gives. The browser remembers which codes it loved (so
 * the button toggles honestly) and this end rate limits, which is the right
 * amount of defence for a counter that decides a sort order and nothing
 * else. Money never reads these numbers.
 */

const ACTIONS = { love: [1, 0], unlove: [-1, 0], play: [0, 1] } as const;

export async function POST(req: Request) {
  const rl = rateLimit(`react:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "Too many reactions. Give it a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );

  const b = (await req.json().catch(() => ({}))) as { code?: string; action?: string };
  const code = String(b.code ?? "").trim().toLowerCase();
  const action = ACTIONS[b.action as keyof typeof ACTIONS];
  if (!code || !action) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const db = supabaseAdmin();
  /* only real, public catalogue rows earn counters */
  const { data: row } = await db
    .from("catalog")
    .select("code")
    .eq("code", code)
    .eq("on_site", true)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [loves, plays] = action;
  await db.rpc("catalog_react", { p_code: code, p_loves: loves, p_plays: plays });

  const { data: stats } = await db
    .from("catalog_stats")
    .select("loves, plays")
    .eq("code", code)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    loves: Number(stats?.loves ?? 0),
    plays: Number(stats?.plays ?? 0),
  });
}
