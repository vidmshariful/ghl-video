import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { isProtectedPath, normalizeSource } from "@/lib/redirects";
import { sitePages } from "@/lib/pages-list";

export const runtime = "nodejs";

/*
 * Redirect rules (admin -> CMS -> SEO -> Redirects). The edge reads these on
 * every request, so the validation here is the safety fence: a typo in this
 * form must never be able to swallow checkout, a portal, or the admin itself,
 * and must never create a redirect loop.
 */

type Body = {
  id?: string;
  source?: string;
  destination?: string;
  permanent?: boolean;
  active?: boolean;
  note?: string;
  /* the caller has seen the "this is a live page" warning and means it */
  confirm?: boolean;
};

function validate(source: string, destination: string): string | null {
  if (!source || source === "/") {
    return "Give the old URL, for example /old-page. The homepage cannot be redirected.";
  }
  if (isProtectedPath(source)) {
    return "That path belongs to checkout, a portal, the admin, or the API, and cannot be redirected.";
  }
  if (!destination) return "Give the destination.";
  const internal = destination.startsWith("/");
  if (!internal && !/^https?:\/\//i.test(destination)) {
    return "The destination must start with / for this site, or https:// for another site.";
  }
  if (internal && normalizeSource(destination) === source) {
    return "The destination is the same as the old URL, which would loop.";
  }
  return null;
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("redirects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ redirects: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const source = normalizeSource(body.source ?? "");
  const destination = (body.destination ?? "").trim();

  const problem = validate(source, destination);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const db = supabaseAdmin();

  /* Chain guard: if the destination is itself a redirect source, the visitor
   * would take two hops (and Google discounts chains). Point it at the final
   * destination instead. */
  if (destination.startsWith("/")) {
    const { data: chained } = await db
      .from("redirects")
      .select("destination")
      .eq("source", normalizeSource(destination))
      .eq("active", true)
      .maybeSingle();
    if (chained) {
      return NextResponse.json(
        {
          error: `That destination is itself redirected to ${chained.destination}. Point this rule straight there instead.`,
        },
        { status: 400 },
      );
    }
  }

  /* A live page as the source is legal but almost always a mistake, so it
   * takes a second, explicit yes. */
  const livePage = sitePages.find(
    (p) => normalizeSource(p.path) === source,
  );
  if (livePage && !body.confirm) {
    return NextResponse.json(
      {
        needsConfirm: true,
        warning: `${source} is the live "${livePage.name}" page. A redirect here takes priority and visitors will never see it again.`,
      },
      { status: 409 },
    );
  }

  const { error } = await db.from("redirects").insert({
    source,
    destination,
    permanent: body.permanent !== false,
    active: body.active !== false,
    note: (body.note ?? "").trim() || null,
    created_by: admin.email,
  });
  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? `There is already a rule for ${source}.`
            : error.message,
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.id) return NextResponse.json({ error: "Which rule?" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.permanent === "boolean") patch.permanent = body.permanent;
  if (typeof body.note === "string") patch.note = body.note.trim() || null;
  if (typeof body.destination === "string") {
    const destination = body.destination.trim();
    const { data: existing } = await supabaseAdmin()
      .from("redirects")
      .select("source")
      .eq("id", body.id)
      .maybeSingle();
    const problem = validate(existing?.source ?? "", destination);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    patch.destination = destination;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("redirects").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.id) return NextResponse.json({ error: "Which rule?" }, { status: 400 });

  const { error } = await supabaseAdmin().from("redirects").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
