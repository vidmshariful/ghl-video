import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { matchFeature, slugifyFeatureKey } from "@/lib/library-features";

export const runtime = "nodejs";

/*
 * The Filter by feature vocabulary, managed.
 *
 * GET returns every row WITH its live match count against the catalogue,
 * because the count is the feedback that makes the screen editable at all:
 * an alias that catches nothing is visible the moment it is typed, not
 * after somebody wonders why the public rail lost an entry.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cleanAliases = (input: unknown): string[] =>
  Array.isArray(input)
    ? [
        ...new Set(
          (input as unknown[])
            .filter((a): a is string => typeof a === "string")
            .map((a) => a.trim().toLowerCase())
            .filter(Boolean),
        ),
      ].slice(0, 12)
    : [];

async function catalogTexts(db: ReturnType<typeof supabaseAdmin>): Promise<string[]> {
  const { data } = await db
    .from("catalog")
    .select("title, subject, category, on_site, coming_soon")
    .eq("on_site", true);
  return ((data ?? []) as Row[])
    .filter((r) => !r.coming_soon)
    .map((r) => `${r.title ?? ""} ${r.subject ?? ""} ${r.category ?? ""}`);
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data: rows }, texts] = await Promise.all([
    db.from("library_features").select("*").order("sort").order("created_at"),
    catalogTexts(db),
  ]);

  return NextResponse.json({
    features: ((rows ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      key: String(r.key),
      label: String(r.label),
      aliases: (r.aliases as string[]) ?? [],
      active: r.active !== false,
      sort: Number(r.sort ?? 0),
      /* how many catalogue rows the aliases catch right now */
      matches: texts.filter((t) => matchFeature(t, (r.aliases as string[]) ?? [])).length,
    })),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Row;
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 80) : "";
  if (!label) return NextResponse.json({ error: "Give the feature a name." }, { status: 400 });
  const key = slugifyFeatureKey(typeof b.key === "string" && b.key ? b.key : label);
  if (!key) return NextResponse.json({ error: "That name makes an empty key." }, { status: 400 });
  const aliases = cleanAliases(b.aliases);

  const db = supabaseAdmin();
  const { data: last } = await db
    .from("library_features")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("library_features")
    .insert({
      key,
      label,
      /* a new feature with no aliases yet gets its own label as the first
         one, which is the match somebody almost always wants */
      aliases: aliases.length ? aliases : [label.toLowerCase()],
      sort: Number(last?.sort ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json(
      { error: /duplicate|unique/i.test(error.message) ? "That feature already exists." : error.message },
      { status: 400 },
    );
  return NextResponse.json({ ok: true, id: String(data.id) });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Row;
  const id = typeof b.id === "string" ? b.id : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Which feature?" }, { status: 400 });

  const patch: Row = {};
  if (typeof b.label === "string" && b.label.trim()) patch.label = b.label.trim().slice(0, 80);
  if ("aliases" in b) patch.aliases = cleanAliases(b.aliases);
  if (typeof b.active === "boolean") patch.active = b.active;
  if (Number.isFinite(Number(b.sort))) patch.sort = Number(b.sort);
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { error } = await supabaseAdmin().from("library_features").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Which feature?" }, { status: 400 });

  await supabaseAdmin().from("library_features").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
