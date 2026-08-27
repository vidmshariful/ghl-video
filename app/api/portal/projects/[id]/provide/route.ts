import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext, actorName } from "@/lib/account-team";
import { normalizePipeline, STATIONS, type StationKey } from "@/lib/pipeline";
import { ensureMainCarrier, syncProjectState } from "@/lib/project-station";
import { addComment } from "@/lib/review";
import { pushAdminNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

/*
 * The client handing over what they promised: their script or their
 * voiceover, as a link. Marking a station "theirs" is a promise; this is
 * the receipt. The station closes when the file lands, and sending a
 * replacement later reopens nothing, it just swaps the link and tells us.
 */

const PROVIDABLE: StationKey[] = ["script", "voiceover"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!contextCan(ctx, "orders"))
    return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });

  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = b.stage as StationKey;
  const url = typeof b.url === "string" ? b.url.trim().slice(0, 2000) : "";

  if (!PROVIDABLE.includes(key))
    return NextResponse.json({ error: "That is not a piece you supply here." }, { status: 400 });
  if (!/^https?:\/\/\S+$/i.test(url))
    return NextResponse.json({ error: "Paste a full link, starting with http." }, { status: 400 });

  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .ilike("customer_email", ctx.ownerEmail)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const line = normalizePipeline(project.pipeline);
  if (!line[key].provided)
    return NextResponse.json(
      { error: "We are making that piece, so there is nothing for you to send." },
      { status: 400 },
    );

  const now = new Date().toISOString();
  const replacing = Boolean(line[key].url);
  const line2 = normalizePipeline({
    ...line,
    [key]: { ...line[key], url, state: "done", at: now },
  });
  const { error } = await db.from("projects").update({ pipeline: line2 }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await syncProjectState(db, id, line2);

  const label = key === "script" ? "script" : "voiceover";
  const mainId = await ensureMainCarrier(db, id);
  if (mainId)
    await addComment(db, {
      deliverableId: mainId,
      side: "client",
      email: ctx.selfEmail,
      name: await actorName(db, ctx),
      body: replacing ? `Sent an updated ${label}: ${url}` : `Added their ${label}: ${url}`,
      atSeconds: null,
      parentId: null,
    });

  await pushAdminNotifications(db, {
    kind: "client_provided",
    title: `${STATIONS[key].label} ${replacing ? "updated" : "received"}: ${String(project.title)}`,
    body: url,
    href: `custom/${id}`,
    vars: {
      stage_label: STATIONS[key].label,
      event: replacing ? "updated" : "received",
      project_title: String(project.title),
      url,
    },
  });

  return NextResponse.json({ ok: true });
}
