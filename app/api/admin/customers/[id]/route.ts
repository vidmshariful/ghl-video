import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { lifetimeValue, serviceTags, type MoneySource } from "@/lib/customer-record";
import { completeness, getBrandKit } from "@/lib/brand-kit";
import { orderKind, type InvoiceLink } from "@/lib/order-kind";
import {
  monthSummary,
  needsFreshAgreement,
  parseRetainer,
  retainerMonths,
  type RetainerJob,
  type RetainerKind,
} from "@/lib/retainer";
import { linesFrom, portalVisibility } from "@/lib/portal-visibility";
import { currentCycle, topupCreditsLeft } from "@/lib/subscription-cycles";
import { creditsUsed } from "@/lib/subscription-slots";
import { customerLinks } from "@/lib/highlevel/links";
import { invoiceDisplayNumber, invoiceOpen, invoiceSettled, invoiceStatusWord } from "@/lib/invoice-state";

/** A short-lived signed URL for a private brand file, or null. */
async function signBrand(db: ReturnType<typeof supabaseAdmin>, path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from("intake").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export const runtime = "nodejs";

/*
 * Everything about one client, in one response.
 *
 * The point of this screen is that nobody has to open five tabs to answer a
 * question about a customer, so the route gathers all of it rather than
 * making the browser stitch it together. Ten reads sounds like a lot until
 * you compare it with the ten screens it replaces.
 */

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const db = supabaseAdmin();
  const { data: c } = await db.from("customers").select("*").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const email = String(c.email).toLowerCase();

  const [
    { data: orders },
    { data: subs },
    { data: invoices },
    { data: members },
    { data: notes },
    { data: convos },
    { data: contacts },
  ] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, product_id, amount_cents, currency, status, fulfillment_stage, invoice_number, created_at, paid_at, intake_completed, product:products(name, sku, metadata)",
      )
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
    db
      .from("subscriptions")
      .select("id, amount_cents, status, created_at, current_period_end, cancel_at_period_end, plan_name, metadata, product:products(name, sku)")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
    db
      .from("invoices")
      .select("id, number, hl_number, token, total_cents, status, due_date, sent_at, created_at, product_sku, product_id, parent_order_id, line_items, paid_at, hl_status, hl_url, hl_invoice_id, kind, source, amount_paid_cents")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
    db
      .from("account_members")
      .select("id, member_email, member_name, features, status, created_at")
      .eq("account_type", "customer")
      .ilike("owner_email", email),
    db
      .from("customer_notes")
      .select("id, author, body, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("conversations")
      .select("id, order_id, last_message_at, last_message_preview, last_sender_role")
      .ilike("customer_email", email)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    db
      .from("customer_contacts")
      .select("id, name, email, phone, role, title, notes, created_at")
      .eq("customer_id", id)
      .order("role"),
  ]);

  /*
   * Everything this customer has, not only what they bought outright.
   *
   * Work belongs to a purchase, a custom project, or a monthly plan, and this
   * list was built from their orders alone. So a customer record could open
   * showing one video for somebody who has twenty one, and nothing at all for
   * a client whose entire relationship is an editing plan. The record is the
   * screen you open to answer "what have we made for these people", and it was
   * answering it wrongly for exactly the clients with the most work.
   */
  const orderIds = ((orders ?? []) as Row[]).map((o) => String(o.id));

  const { data: theirProjects } = await db
    .from("projects")
    .select("id, title, status, retainer_month, retainer_kind, created_at, due_at, owner_email, agreed_cents, quoted_cents")
    .ilike("customer_email", email)
    .order("created_at", { ascending: false });
  const projectIds = ((theirProjects ?? []) as Row[]).map((p) => String(p.id));

  const { data: theirSubs } = await db
    .from("subscriptions")
    .select("id")
    .ilike("customer_email", email);
  const { data: theirCycles } = theirSubs?.length
    ? await db
        .from("subscription_cycles")
        .select("id")
        .in("subscription_id", ((theirSubs ?? []) as Row[]).map((x) => String(x.id)))
    : { data: [] };
  const cycleIds = ((theirCycles ?? []) as Row[]).map((c) => String(c.id));

  /* one query per owner rather than an or() across three columns: the filter
     stays readable and an empty list stays an empty list */
  const buckets = await Promise.all(
    (
      [
        ["order_id", orderIds],
        ["project_id", projectIds],
        ["cycle_id", cycleIds],
      ] as const
    ).map(async ([column, ids]) => {
      if (!ids.length) return [] as Row[];
      const { data } = await db
        .from("order_deliverables")
        .select(
          "id, order_id, project_id, cycle_id, title, status, due_at, ready_at, approved_at, position, created_at",
        )
        .in(column, ids)
        .order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    }),
  );
  const videos = buckets
    .flat()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const kit = await getBrandKit(db, id);

  /* which product each invoice bills through, so an order can say what it was */
  const invoiceByProduct = new Map<string, InvoiceLink>(
    ((invoices ?? []) as Row[])
      .filter((i) => i.product_id)
      .map((i) => [
        String(i.product_id),
        {
          productId: String(i.product_id),
          parentOrderId: (i.parent_order_id as string | null) ?? null,
        },
      ]),
  );
  const kindOf = (o: Row) =>
    orderKind(
      (o.product_id as string | null) ?? null,
      ((o.product as { metadata?: { invoice?: unknown } } | null)?.metadata ?? null),
      invoiceByProduct,
    );

  const money: MoneySource = {
    orders: ((orders ?? []) as Row[]).map((o) => ({
      amountCents: Number(o.amount_cents),
      status: String(o.status),
      kind: kindOf(o),
    })),
    subscriptions: ((subs ?? []) as Row[]).map((s) => ({
      amountCents: s.amount_cents == null ? null : Number(s.amount_cents),
      status: String(s.status),
      createdAt: String(s.created_at),
      currentPeriodEnd: (s.current_period_end as string | null) ?? null,
    })),
    /* paid in HighLevel, with no order behind it: counted from the invoice */
    paidInvoices: ((invoices ?? []) as Row[])
      .filter((i) => !i.product_id && invoiceSettled(i))
      .map((i) => ({
        amountCents: Number(i.amount_paid_cents || i.total_cents),
        kind: (["custom", "addon", "retainer", "premade", "plan"].includes(String(i.kind)) ? String(i.kind) : "custom") as
          | "custom"
          | "addon"
          | "retainer"
          | "premade"
          | "plan",
      })),
    openInvoices: ((invoices ?? []) as Row[])
      .filter((i) => invoiceOpen(i))
      .map((i) => ({ totalCents: Number(i.total_cents) })),
  };
  const value = lifetimeValue(money, new Date());

  /*
   * The partnership, month by month, for an account on a retainer.
   *
   * The count is the one question the studio has about a retainer client
   * every month, and it was being answered by scrolling the projects list.
   * Every month since the start is a row, zeros included, so a quiet month
   * shows as quiet rather than missing.
   */
  const retainer = parseRetainer(c.retainer);
  const jobs = ((theirProjects ?? []) as Row[]).map((p) => ({
    id: String(p.id),
    title: String(p.title),
    status: String(p.status),
    retainerMonth: (p.retainer_month as string | null) ?? null,
    retainerKind: (p.retainer_kind as RetainerKind | null) ?? null,
    createdAt: String(p.created_at),
  }));
  /* where they are in HighLevel: the contact, each project's deal card */
  const hl = await customerLinks(db, id, jobs.map((j) => j.id));

  const partnership = retainer
    ? {
        months: retainerMonths(retainer.startedOn, new Date()).map((m) =>
          monthSummary(jobs as RetainerJob[], m),
        ),
        jobs: jobs
          .filter((j) => j.retainerKind)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      }
    : null;

  /*
   * The service lines and what their portal shows, decided by the same rule
   * the portal itself runs (lib/portal-visibility.ts), so the record can say
   * "they see this because they have that" rather than guessing.
   */
  const paidOrders = money.orders.filter((o) => o.status === "paid");
  const lines = linesFrom({
    premadeOrders: paidOrders.filter((o) => o.kind !== "custom").length,
    projects: jobs.filter((j) => j.status !== "cancelled").length,
    directBrief: Boolean(c.can_submit_projects),
    subscriptions: money.subscriptions.length,
  });
  const visibility = portalVisibility({
    lines,
    retainer: retainer !== null,
    hasBilling:
      money.orders.length > 0 || ((invoices ?? []) as Row[]).some((i) => i.status !== "void"),
    hasPlanBilling: money.subscriptions.length > 0,
    hidden: (c.hidden_sections as string[] | null) ?? [],
    disabled: (c.disabled_sections as string[] | null) ?? [],
  });

  /* the editing plan's month, for the record's Editing tab: the same
     arithmetic the board and the portal use */
  const liveSub = ((subs ?? []) as Row[]).find((x) =>
    ["active", "trialing", "past_due"].includes(String(x.status)),
  );
  let plan: Record<string, unknown> | null = null;
  if (liveSub) {
    const sku =
      (liveSub.product as { sku?: string } | null)?.sku ??
      (liveSub.metadata as { sku?: string } | null)?.sku ??
      null;
    const cycle = await currentCycle(db, {
      id: String(liveSub.id),
      current_period_end: (liveSub.current_period_end as string | null) ?? null,
      product: { sku },
    });
    if (cycle) {
      const { data: work } = await db
        .from("order_deliverables")
        .select("credit_cost, cancelled_at, status")
        .eq("cycle_id", cycle.id);
      const rows = (work ?? []) as Row[];
      const use = creditsUsed(
        rows.map((w) => ({
          creditCost: Number(w.credit_cost ?? 0),
          cancelledAt: (w.cancelled_at as string | null) ?? null,
        })),
        cycle.creditsAllowed,
        await topupCreditsLeft(db, String(liveSub.id)),
      );
      plan = {
        subscriptionId: String(liveSub.id),
        planName:
          (liveSub.plan_name as string | null) ??
          (liveSub.product as { name?: string } | null)?.name ??
          "Editing",
        cycle: { startsAt: cycle.periodStart, endsAt: cycle.periodEnd },
        credits: use,
        inReview: rows.filter((w) => !w.cancelled_at && String(w.status) === "ready").length,
        inProduction: rows.filter((w) => !w.cancelled_at && String(w.status) === "in_production").length,
      };
    }
  }

  return NextResponse.json({
    customer: {
      id,
      email: String(c.email),
      name: (c.name as string | null) ?? null,
      company: (c.company as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      slug: (c.slug as string | null) ?? null,
      tags: (c.tags as string[] | null) ?? [],
      hiddenSections: (c.hidden_sections as string[] | null) ?? [],
      disabledSections: (c.disabled_sections as string[] | null) ?? [],
      canSubmitProjects: Boolean(c.can_submit_projects),
      retainer,
      /* the door they came through, and whether they are ours */
      source: (c.source as string | null) ?? null,
      internal: Boolean(c.internal),
      welcomedAt: (c.welcomed_at as string | null) ?? null,
      lastSeenAt: (c.last_seen_at as string | null) ?? null,
      createdAt: String(c.created_at),
      highlevelContactId: (c.highlevel_contact_id as string | null) ?? null,
      /* the partnership's monthly bill, scheduled in HighLevel */
      retainerScheduleId: (c.hl_retainer_schedule_id as string | null) ?? null,
    },
    highlevel: hl.customer,
    lines,
    visibility,
    plan,
    projects: ((theirProjects ?? []) as Row[]).map((p) => ({
      id: String(p.id),
      title: String(p.title),
      status: String(p.status),
      dueAt: (p.due_at as string | null) ?? null,
      ownerEmail: (p.owner_email as string | null) ?? null,
      agreedCents: p.agreed_cents == null ? null : Number(p.agreed_cents),
      quotedCents: p.quoted_cents == null ? null : Number(p.quoted_cents),
      retainerMonth: (p.retainer_month as string | null) ?? null,
      retainerKind: (p.retainer_kind as RetainerKind | null) ?? null,
      createdAt: String(p.created_at),
      highlevelUrl: hl.dealUrls[String(p.id)] ?? null,
    })),
    partnership,
    value,
    services: serviceTags({
      paidOrders: money.orders.filter((o) => o.status === "paid" && o.kind !== "custom").length,
      /* an add-on never makes somebody a custom client */
      projects: money.orders.filter((o) => o.status === "paid" && o.kind === "custom").length,
      liveSubscriptions: money.subscriptions.filter((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      ).length,
    }),
    orders: ((orders ?? []) as Row[]).map((o) => ({
      id: String(o.id),
      productName: (o.product as { name?: string } | null)?.name ?? null,
      productSku: (o.product as { sku?: string } | null)?.sku ?? null,
      kind: kindOf(o),
      /* an add-on hangs under the order it topped up */
      parentOrderId:
        ((invoices ?? []) as Row[]).find((i) => i.product_id === o.product_id)?.parent_order_id ??
        null,
      amountCents: Number(o.amount_cents),
      status: String(o.status),
      stage: String(o.fulfillment_stage),
      invoiceNumber: (o.invoice_number as string | null) ?? null,
      intakeCompleted: Boolean(o.intake_completed),
      createdAt: String(o.created_at),
    })),
    subscriptions: ((subs ?? []) as Row[]).map((s) => ({
      id: String(s.id),
      planName: (s.plan_name as string | null) ?? (s.product as { name?: string } | null)?.name ?? null,
      sku: (s.product as { sku?: string } | null)?.sku ?? null,
      amountCents: s.amount_cents == null ? null : Number(s.amount_cents),
      status: String(s.status),
      currentPeriodEnd: (s.current_period_end as string | null) ?? null,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      createdAt: String(s.created_at),
    })),
    invoices: ((invoices ?? []) as Row[]).map((i) => ({
      id: String(i.id),
      number: invoiceDisplayNumber(i),
      token: String(i.token),
      totalCents: Number(i.total_cents),
      status: invoiceStatusWord(i),
      paid: invoiceSettled(i),
      paidAt: (i.paid_at as string | null) ?? null,
      kind: String(i.kind ?? "custom"),
      source: String(i.source ?? "platform"),
      /* HighLevel's pay page, once the invoice is there */
      payUrl: (i.hl_url as string | null) ?? null,
      parentOrderId: (i.parent_order_id as string | null) ?? null,
      dueDate: (i.due_date as string | null) ?? null,
      sentAt: (i.sent_at as string | null) ?? null,
      createdAt: String(i.created_at),
    })),
    videos: ((videos ?? []) as Row[]).map((v) => ({
      id: String(v.id),
      /* null for project and plan work, which has no order behind it */
      orderId: (v.order_id as string | null) ?? null,
      title: String(v.title),
      status: String(v.status),
      dueAt: (v.due_at as string | null) ?? null,
      /* where this came from, so the record can say so rather than implying
         everything was a purchase */
      source: v.order_id ? "purchase" : v.project_id ? "project" : "plan",
    })),
    team: ((members ?? []) as Row[]).map((m) => ({
      id: String(m.id),
      email: String(m.member_email),
      name: (m.member_name as string | null) ?? null,
      features: (m.features as string[] | null) ?? null,
      status: String(m.status),
    })),
    notes: ((notes ?? []) as Row[]).map((n) => ({
      id: String(n.id),
      author: String(n.author),
      body: String(n.body),
      createdAt: String(n.created_at),
    })),
    conversations: ((convos ?? []) as Row[]).map((v) => ({
      id: String(v.id),
      orderId: (v.order_id as string | null) ?? null,
      lastMessageAt: (v.last_message_at as string | null) ?? null,
      preview: (v.last_message_preview as string | null) ?? null,
      lastSender: (v.last_sender_role as string | null) ?? null,
    })),
    contacts: ((contacts ?? []) as Row[]).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      role: String(c.role),
      title: (c.title as string | null) ?? null,
      notes: (c.notes as string | null) ?? null,
    })),
    brandKit: kit
      ? {
          kit,
          completeness: completeness(kit),
          /*
           * All at once. These were three awaits in a row, and each one is a
           * round trip to storage: 760ms sequential against 226ms together,
           * measured. Half a second thrown away on every load of this screen,
           * and it is loaded again after every single edit on it.
           */
          ...(await (async () => {
            const [logoDarkUrl, logoLightUrl, logoUrl, guidelines] = await Promise.all([
              signBrand(db, kit.logoDarkPath),
              signBrand(db, kit.logoLightPath),
              signBrand(db, kit.logoPath),
              Promise.all(
                (kit.guidelineFiles ?? []).map(async (g) => ({
                  ...g,
                  url: await signBrand(db, g.path),
                })),
              ),
            ]);
            return { logoDarkUrl, logoLightUrl, logoUrl, guidelines };
          })()),
        }
      : { kit: null, completeness: completeness(null) },
  });
}

/** Tags, hidden sections and notes: the three things admin edits here. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();

  if (typeof b.note === "string" && b.note.trim()) {
    /* returning the row it wrote, so the screen can put the note straight in
       the list. It used to answer {ok:true} and leave the client no choice
       but to re-download everything to see one line it already had. */
    const { data: note, error } = await db
      .from("customer_notes")
      .insert({ customer_id: id, author: admin.email, body: b.note.trim().slice(0, 4000) })
      .select("id, author, body, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, note });
  }

  const patch: Record<string, unknown> = {};
  if (Array.isArray(b.tags)) {
    patch.tags = (b.tags as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 20);
  }
  /* a commercial decision about this account: they brief us directly with no
     quote in between. Deliberately not part of the section toggles, which are
     about what a client can SEE. */
  if (typeof b.canSubmitProjects === "boolean") {
    patch.can_submit_projects = b.canSubmitProjects;
  }
  /* ours, not a client: out of the list and the totals */
  if (typeof b.internal === "boolean") patch.internal = b.internal;
  if (Array.isArray(b.hiddenSections)) {
    patch.hidden_sections = (b.hiddenSections as unknown[])
      .filter((t): t is string => typeof t === "string")
      .slice(0, 30);
  }
  if (Array.isArray(b.disabledSections)) {
    patch.disabled_sections = (b.disabledSections as unknown[])
      .filter((t): t is string => typeof t === "string")
      .slice(0, 30);
  }
  /* the retainer terms: null clears them, anything else has to parse to a
     real monthly fee. parseRetainer is the one place the shape is decided,
     so what is stored is exactly what every screen will read back. */
  if ("retainer" in b) {
    if (b.retainer === null) patch.retainer = null;
    else {
      const terms = parseRetainer(b.retainer);
      if (!terms)
        return NextResponse.json({ error: "A retainer needs a monthly fee." }, { status: 400 });
      /* the partner's acceptance is theirs, not the form's: it survives an
         edit that leaves the deal as it was, and is cleared by one that
         changes the fee or the count, which needs accepting again */
      const { data: current } = await db.from("customers").select("retainer").eq("id", id).maybeSingle();
      const before = parseRetainer(current?.retainer);
      const keep = before && !needsFreshAgreement(before, terms);
      patch.retainer = keep ? { ...terms, agreedOn: before.agreedOn, agreedBy: before.agreedBy } : { ...terms, agreedOn: null, agreedBy: null };
    }
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data: row, error } = await db
    .from("customers")
    .update(patch)
    .eq("id", id)
    .select("tags, hidden_sections, disabled_sections, can_submit_projects, retainer, internal")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  /* the truth after the write, so the screen can settle on it rather than
     trusting what it guessed */
  return NextResponse.json({
    ok: true,
    customer: {
      tags: (row?.tags as string[] | null) ?? [],
      hiddenSections: (row?.hidden_sections as string[] | null) ?? [],
      disabledSections: (row?.disabled_sections as string[] | null) ?? [],
      canSubmitProjects: Boolean(row?.can_submit_projects),
      retainer: parseRetainer(row?.retainer),
      internal: Boolean(row?.internal),
    },
  });
}
