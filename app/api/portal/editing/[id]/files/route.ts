import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import {
  addDeliverableFile,
  listDeliverableFiles,
  removeDeliverableFile,
} from "@/lib/project-files";

export const runtime = "nodejs";

/*
 * The client's side of an editing request's attachments.
 *
 * The footage is a link, because footage is gigabytes and lives where they
 * already keep it. Everything else that has to go IN the video is small and
 * was arriving by email: a logo, a headshot, a font file, the three product
 * screenshots they mention in the brief. Those come here, onto the request
 * itself, so the editor opening the card has them rather than hunting a
 * thread.
 *
 * The same private bucket and the same rules as a project's attachments, one
 * layer down in lib/project-files. Every call proves the caller owns the
 * request's cycle first.
 */

async function guard(req: Request, id: string) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return { fail: NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus }) };
  if (!contextCan(ctx, "subscriptions"))
    return { fail: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };

  /* a plan request, on a cycle belonging to this account. An order or project
     deliverable has its own files elsewhere and must not be reachable here. */
  const { data: d } = await db
    .from("order_deliverables")
    .select("id, cycle_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!d?.cycle_id) return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  const { data: cyc } = await db
    .from("subscription_cycles")
    .select("subscription:subscriptions!inner(customer_email)")
    .eq("id", d.cycle_id)
    .maybeSingle();
  const owner = (cyc?.subscription as { customer_email?: string } | null)?.customer_email ?? "";
  if (owner.toLowerCase() !== ctx.ownerEmail.toLowerCase())
    return { fail: NextResponse.json({ error: "Not found." }, { status: 404 }) };

  const { data: customer } = await db
    .from("customers")
    .select("name")
    .ilike("email", ctx.ownerEmail)
    .maybeSingle();

  return { db, ctx, status: String(d.status), name: (customer?.name as string | null) ?? null };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;
  return NextResponse.json({ files: await listDeliverableFiles(g.db, id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const res = await addDeliverableFile(g.db, {
    deliverableId: id,
    file,
    side: "client",
    email: g.ctx.ownerEmail,
    name: g.name,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(req, id);
  if ("fail" in g) return g.fail;

  const fileId = new URL(req.url).searchParams.get("fileId") ?? "";
  if (!fileId) return NextResponse.json({ error: "Which file?" }, { status: 400 });

  const ok = await removeDeliverableFile(g.db, { id: fileId, deliverableId: id });
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
