import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { ballInCourt, normalizePipeline } from "@/lib/pipeline";
import {
  PROJECT_LIST,
  PROJECT_STATUSES,
  normalizeProjectStatus,
  projectBalance,
  type ProjectStatus,
} from "@/lib/projects";

export const runtime = "nodejs";

/*
 * Custom video jobs.
 *
 * Most are created here by hand, because most close on a call or a referral
 * with no quoting at all. The website enquiries that DO arrive live in
 * project_requests and are converted across, which is why the two are
 * separate: forcing a referral through an enquiry stage would be paperwork
 * invented for the sake of a tidy funnel.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const cents = (v: unknown) => {
  /* empty means no price, not zero: clearing the field on an edit has to be
     able to set it back to nothing */
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data: projects }, { data: invoices }, { data: videos }] = await Promise.all([
    db.from("projects").select("*").order("created_at", { ascending: false }),
    db
      .from("invoices")
      .select("id, number, total_cents, status, project_id, product_sku")
      .not("project_id", "is", null),
    db
      .from("order_deliverables")
      /* select * so this runs the same before and after the pipeline column
         exists; normalizePipeline treats missing as a fresh line */
      .select("*")
      .not("project_id", "is", null)
      .order("position", { ascending: true }),
  ]);

  /* an invoice is paid when a paid order exists for its backing product */
  const { data: paidOrders } = await db
    .from("orders")
    .select("product:products(sku)")
    .eq("status", "paid");
  const paidSkus = new Set(
    ((paidOrders ?? []) as Row[]).map((o) => String((o.product as { sku?: unknown } | null)?.sku ?? "")),
  );

  const { data: contacts } = await db
    .from("customer_contacts")
    .select("id, name, role, email");
  const { data: team } = await db.from("admins").select("email, name");
  const contactById = new Map(((contacts ?? []) as Row[]).map((c) => [String(c.id), c]));

  const items = ((projects ?? []) as Row[]).map((p) => {
    const id = String(p.id);
    const mine = ((invoices ?? []) as Row[])
      .filter((i) => String(i.project_id) === id)
      .map((i) => ({
        id: String(i.id),
        number: String(i.number),
        totalCents: Number(i.total_cents),
        status: String(i.status),
        paid: paidSkus.has(String(i.product_sku)),
      }));
    const money = projectBalance(
      {
        quotedCents: p.quoted_cents == null ? null : Number(p.quoted_cents),
        agreedCents: p.agreed_cents == null ? null : Number(p.agreed_cents),
      },
      mine,
    );
    const line = normalizePipeline(p.pipeline);
    return {
      id,
      customerEmail: String(p.customer_email),
      customerId: (p.customer_id as string | null) ?? null,
      title: String(p.title),
      brief: (p.brief as string | null) ?? null,
      status: normalizeProjectStatus(String(p.status)),
      /* whether a person pinned this stage by hand; undefined column (pre
         migration) reads as not locked, i.e. still following the line */
      stageLocked: Boolean(p.stage_locked),
      category: (p.category as string | null) ?? null,
      tags: ((p.tags as string[] | null) ?? []).slice(0, 12),
      pipeline: line,
      ball: ballInCourt(line),
      quotedCents: p.quoted_cents == null ? null : Number(p.quoted_cents),
      agreedCents: p.agreed_cents == null ? null : Number(p.agreed_cents),
      ownerEmail: (p.owner_email as string | null) ?? null,
      dueAt: (p.due_at as string | null) ?? null,
      contactId: (p.contact_id as string | null) ?? null,
      contact: p.contact_id
        ? (() => {
            const c = contactById.get(String(p.contact_id));
            return c ? { name: String(c.name), role: String(c.role), email: (c.email as string | null) ?? null } : null;
          })()
        : null,
      createdAt: String(p.created_at),
      invoices: mine,
      money,
      mainVideo: (() => {
        const mv = ((videos ?? []) as Row[]).find(
          (v) => String(v.project_id) === id && String(v.category ?? "") === "main",
        );
        return mv
          ? {
              id: String(mv.id),
              videoUrl: (mv.video_url as string | null) ?? null,
              revisionRound: Number(mv.revision_round ?? 0),
            }
          : null;
      })(),
      formats: ((videos ?? []) as Row[])
        .filter((v) => String(v.project_id) === id && String(v.category ?? "") === "format")
        .map((v) => ({
          id: String(v.id),
          title: String(v.title),
          status: String(v.status),
          videoUrl: (v.video_url as string | null) ?? null,
        })),
    };
  });

  return NextResponse.json({
    projects: items,
    team: ((team ?? []) as Row[]).map((t) => ({
      email: String(t.email),
      name: (t.name as string | null) ?? String(t.email),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = str(b.customerEmail, 200)?.toLowerCase();
  const title = str(b.title, 160);
  if (!email) return NextResponse.json({ error: "Which client is this for?" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Give the job a name." }, { status: 400 });

  const db = supabaseAdmin();
  /* link to the customer row when one exists; a brand new client can be
   * quoted before they have ever bought, and that must not block the job */
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  const { data, error } = await db
    .from("projects")
    .insert({
      customer_email: email,
      customer_id: (customer?.id as string | undefined) ?? null,
      title,
      category: str(b.category, 60),
      brief: str(b.brief, 8000),
      status: PROJECT_STATUSES.includes(b.status as ProjectStatus) ? b.status : "backlog",
      quoted_cents: cents(b.quotedCents),
      agreed_cents: cents(b.agreedCents),
      owner_email: str(b.ownerEmail, 200) ?? admin.email,
      due_at: str(b.dueAt, 40),
      contact_id: str(b.contactId, 64),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /* a converted enquiry stops being an open lead and points at its job */
  const fromRequest = str(b.fromRequestId, 64);
  if (fromRequest && UUID_RE.test(fromRequest)) {
    await db
      .from("project_requests")
      .update({ status: "won", project_id: data.id })
      .eq("id", fromRequest);
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = str(b.id, 64);
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: "Which job?" }, { status: 400 });

  const db = supabaseAdmin();

  /* ---- the production line, project level ---- */
  if (b.station && typeof b.station === "object") {
    const { handleStationOp } = await import("@/lib/project-station");
    const out = await handleStationOp(db, id, b.station as Record<string, unknown>);
    return NextResponse.json(out.body, { status: out.status });
  }
  if (b.action === "add_draft") {
    const { handleAddDraft } = await import("@/lib/project-station");
    const out = await handleAddDraft(db, id, str(b.url, 2000), str(b.note, 400), admin.email);
    return NextResponse.json(out.body, { status: out.status });
  }

  const patch: Record<string, unknown> = {};

  /*
   * The stage.
   *
   * It normally follows the production line. Three deliberate exceptions,
   * all a person's word rather than the arithmetic's:
   *
   *  - a manual pin: any of the seven open stages, which stops the line from
   *    moving it until the pin is released (owner decision, 23 August 2026);
   *  - closed / cancelled, which halt the job entirely;
   *  - reopen and "follow the line again", which hand control back to the
   *    arithmetic and re-derive on the spot so the stage is true immediately.
   */
  let unlock = false;
  if (typeof b.stage === "string" && (PROJECT_LIST as string[]).includes(b.stage)) {
    patch.status = b.stage;
    patch.stage_locked = true;
  }
  if (b.status === "closed" || b.status === "cancelled") patch.status = b.status;
  if (b.status === "backlog") {
    /* reopen: back to the top and following the line again */
    patch.status = "backlog";
    patch.stage_locked = false;
    unlock = true;
  }
  if (b.stageLocked === false) {
    patch.stage_locked = false;
    unlock = true;
  }
  if ("category" in b) patch.category = str(b.category, 60);
  if (Array.isArray(b.tags))
    patch.tags = (b.tags as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 12);
  if ("title" in b) patch.title = str(b.title, 160);
  if ("brief" in b) patch.brief = str(b.brief, 8000);
  if ("quotedCents" in b) patch.quoted_cents = cents(b.quotedCents);
  if ("agreedCents" in b) patch.agreed_cents = cents(b.agreedCents);
  if ("ownerEmail" in b) patch.owner_email = str(b.ownerEmail, 200);
  if ("dueAt" in b) patch.due_at = str(b.dueAt, 40);
  if ("contactId" in b) patch.contact_id = str(b.contactId, 64);
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  let { error } = await db.from("projects").update(patch).eq("id", id);
  /* graceful until the stage_locked column exists: apply everything else and
     skip the lock, so pinning a stage still changes it (it just will not
     stick yet) rather than erroring on the click */
  if (error && "stage_locked" in patch && /stage_locked/.test(error.message)) {
    const rest = { ...patch };
    delete rest.stage_locked;
    if (Object.keys(rest).length) {
      ({ error } = await db.from("projects").update(rest).eq("id", id));
    } else {
      error = null;
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /* handing control back to the line means the stored stage may now be
     stale, so recompute it from the pipeline right away rather than waiting
     for the next station move */
  if (unlock) {
    const { data: proj } = await db.from("projects").select("pipeline").eq("id", id).single();
    if (proj) {
      const { normalizePipeline } = await import("@/lib/pipeline");
      const { syncProjectState } = await import("@/lib/project-station");
      await syncProjectState(db, id, normalizePipeline((proj as Row).pipeline));
    }
  }
  return NextResponse.json({ ok: true });
}
