import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { ASPECTS } from "@/lib/editing-sop";

export const runtime = "nodejs";

/*
 * How this client wants their videos cut, written once instead of every
 * month.
 *
 * Not the Brand Kit. That is the brand itself, logo and colours and how the
 * name is said, and it is shared with premade work. This is the editing
 * brief: intro and outro, captions, music, pacing, b roll, and the things we
 * must never do. The studio reads the same row on their board.
 *
 * It is the cheapest thing in the whole system to build and the most
 * expensive thing to skip, because everything it does not say gets asked
 * again, or guessed wrong and then fixed in a revision round.
 */

const FIELDS = [
  "intro_outro",
  "caption_style",
  "music",
  "pacing",
  "broll",
  "avoid",
  "notes",
] as const;

type Row = Record<string, unknown>;

function shape(r: Row | null) {
  return {
    introOutro: (r?.intro_outro as string | null) ?? "",
    captionStyle: (r?.caption_style as string | null) ?? "",
    music: (r?.music as string | null) ?? "",
    pacing: (r?.pacing as string | null) ?? "",
    broll: (r?.broll as string | null) ?? "",
    avoid: (r?.avoid as string | null) ?? "",
    notes: (r?.notes as string | null) ?? "",
    defaultAspect: (r?.default_aspect as string | null) ?? null,
    referenceUrls: (r?.reference_urls as string[] | null) ?? [],
    updatedAt: (r?.updated_at as string | null) ?? null,
  };
}

export async function GET(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "subscriptions"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const { data } = await db
    .from("editing_style_guides")
    .select("*")
    .eq("customer_email", ctx.ownerEmail.toLowerCase())
    .maybeSingle();

  return NextResponse.json({ guide: shape(data as Row | null) });
}

export async function PUT(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "subscriptions"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const camel: Record<(typeof FIELDS)[number], string> = {
    intro_outro: "introOutro",
    caption_style: "captionStyle",
    music: "music",
    pacing: "pacing",
    broll: "broll",
    avoid: "avoid",
    notes: "notes",
  };

  const patch: Record<string, unknown> = {
    customer_email: ctx.ownerEmail.toLowerCase(),
    updated_by: ctx.selfEmail,
  };
  for (const f of FIELDS) {
    const v = b[camel[f]];
    if (typeof v === "string") patch[f] = v.trim().slice(0, 2000) || null;
  }
  if (ASPECTS.some((a) => a.key === b.defaultAspect)) patch.default_aspect = b.defaultAspect;

  const refs = Array.isArray(b.referenceUrls)
    ? (b.referenceUrls as unknown[])
        .filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
        .map((u) => u.trim().slice(0, 1000))
        .slice(0, 8)
    : null;
  if (refs) patch.reference_urls = refs;

  const { data, error } = await db
    .from("editing_style_guides")
    .upsert(patch, { onConflict: "customer_email" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });

  return NextResponse.json({ ok: true, guide: shape(data as Row) });
}
