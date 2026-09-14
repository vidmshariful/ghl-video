/*
 * The facts the platform must never contradict, checked against the live
 * rows.
 *
 * Every bug this month was one of these being false somewhere: a video with
 * no owner, a paid bill that grew a video, a batch that never finished, an
 * account with no handle, a bell pointing at a section that does not exist.
 * Each was found by a person reading. This runs the same reads every night
 * and raises an alarm on the Health screen, so the platform says it before a
 * client does.
 *
 * Pure reads. Nothing here repairs anything: a repair is a decision, and the
 * alarm carries enough (the check, the count, a sample of ids) to make it.
 * Shared by the cron route and by `npm run check:invariants`, so what the
 * night checks is what a person can run by hand.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchStatusFor, creditCost, isBatch, tierFor, isPodcast, type EditType } from "@/lib/editing-credits";
import { PORTAL_SECTIONS } from "@/app/portal/sections";
import { HIDEABLE_KEYS } from "@/app/admin/customer-sections";
import { parseRetainer } from "@/lib/retainer";
import { invoiceSkipReason } from "@/lib/highlevel/money";
import { videoOwner } from "@/lib/highlevel/sync";

type DB = SupabaseClient;
type Row = Record<string, unknown>;

export type Severity = "warn" | "error";

export type InvariantResult = {
  key: string;
  /** what is true when this passes, in the owner's words */
  rule: string;
  severity: Severity;
  count: number;
  /** a handful of ids or emails, enough to open the right record */
  sample: string[];
};

const SAMPLE = 6;
const short = (v: unknown) => String(v ?? "").slice(0, 8);

type Check = (db: DB) => Promise<{ count: number; sample: string[] }>;

const CHECKS: { key: string; rule: string; severity: Severity; run: Check }[] = [
  {
    key: "void_invoice_paid",
    rule: "A void invoice is never paid.",
    severity: "error",
    run: async (db) => {
      const { data } = await db.from("invoices").select("id, number").eq("status", "void").not("paid_at", "is", null);
      return tally(data, (r) => String(r.number));
    },
  },
  {
    key: "invoice_not_in_highlevel",
    rule: "An invoice raised here reaches HighLevel within five minutes.",
    severity: "warn",
    run: async (db) => {
      const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
      const [{ data }, { data: internal }] = await Promise.all([
        db
          .from("invoices")
          .select("id, number, total_cents, customer_email")
          .eq("source", "platform")
          .eq("status", "open")
          .is("product_id", null)
          .is("hl_invoice_id", null)
          .lt("created_at", cutoff),
        db.from("customers").select("email").eq("internal", true),
      ]);
      /* the demo account's props and a bill for nothing are never sent, by
         design: the sync's own rule says which, so the check cannot drift
         from it (the two demo invoices tripped this every night; audit, 15
         September 2026) */
      const demo = new Set(((internal ?? []) as Row[]).map((c) => String(c.email ?? "").toLowerCase()));
      const rows = ((data ?? []) as Row[]).filter(
        (r) => invoiceSkipReason(r, { internal: demo.has(String(r.customer_email ?? "").toLowerCase()) }) === null,
      );
      return tally(rows, (r) => String(r.number));
    },
  },
  {
    key: "video_no_owner",
    rule: "Every video belongs to an order, a project or a plan month.",
    severity: "error",
    run: async (db) => {
      const { data } = await db
        .from("order_deliverables")
        .select("id")
        .is("order_id", null)
        .is("project_id", null)
        .is("cycle_id", null);
      return tally(data, (r) => short(r.id));
    },
  },
  {
    key: "invoice_order_has_video",
    rule: "A paid invoice is money, never a video.",
    severity: "error",
    run: async (db) => {
      const { data: orders } = await db
        .from("orders")
        .select("id, product:products(metadata)")
        .not("product_id", "is", null);
      const invoiceOrders = ((orders ?? []) as Row[])
        .filter((o) => (o.product as { metadata?: { invoice?: unknown } } | null)?.metadata?.invoice)
        .map((o) => String(o.id));
      if (!invoiceOrders.length) return { count: 0, sample: [] };
      const { data } = await db.from("order_deliverables").select("id, order_id").in("order_id", invoiceOrders);
      return tally(data, (r) => `${short(r.order_id)} video ${short(r.id)}`);
    },
  },
  {
    key: "batch_stage_wrong",
    rule: "A batch of shorts sits where its shorts are.",
    severity: "error",
    run: async (db) => {
      const { data: rows } = await db
        .from("order_deliverables")
        .select("id, parent_id, edit_type, status, cancelled_at")
        .not("cycle_id", "is", null);
      const all = (rows ?? []) as Row[];
      const bad: string[] = [];
      for (const p of all) {
        if (!isBatch((p.edit_type as string | null) ?? null) || p.cancelled_at) continue;
        const kids = all.filter((k) => k.parent_id === p.id);
        const want = batchStatusFor(
          kids.map((k) => ({ status: String(k.status), cancelledAt: (k.cancelled_at as string | null) ?? null })),
        );
        if (want && want !== p.status) bad.push(`${short(p.id)} is ${String(p.status)}, shorts say ${want}`);
      }
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "cut_outside_parent_month",
    rule: "A short cut lives in the same plan month as the request it came from.",
    severity: "error",
    run: async (db) => {
      const { data: rows } = await db
        .from("order_deliverables")
        .select("id, parent_id, cycle_id")
        .not("cycle_id", "is", null);
      const all = (rows ?? []) as Row[];
      const byId = new Map(all.map((r) => [String(r.id), r]));
      const bad = all
        .filter((r) => r.parent_id && byId.get(String(r.parent_id))?.cycle_id !== r.cycle_id)
        .map((r) => short(r.id));
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "plan_row_bad_cost",
    rule: "Every editing request carries the credits its type costs; a batch costs nothing.",
    severity: "warn",
    run: async (db) => {
      const { data: rows } = await db
        .from("order_deliverables")
        .select("id, edit_type, credit_cost, runtime_minutes, cancelled_at")
        .not("cycle_id", "is", null)
        .is("cancelled_at", null);
      const bad: string[] = [];
      for (const r of (rows ?? []) as Row[]) {
        const cost = r.credit_cost == null ? null : Number(r.credit_cost);
        const type = (r.edit_type as string | null) ?? null;
        if (cost == null || cost < 0) { bad.push(`${short(r.id)} has no cost`); continue; }
        if (isBatch(type) && cost !== 0) { bad.push(`${short(r.id)} batch costs ${cost}`); continue; }
        const tier = tierFor(String(type ?? ""));
        if (!tier) continue;
        const want = creditCost(
          tier.key as EditType,
          isPodcast(tier.key as EditType) ? (r.runtime_minutes == null ? null : Number(r.runtime_minutes)) : null,
        );
        if (want !== cost) bad.push(`${short(r.id)} ${String(type)} costs ${cost}, tier says ${want}`);
      }
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "ready_without_cut",
    rule: "A video in Review or Approved has a cut to watch.",
    severity: "warn",
    run: async (db) => {
      /* a custom project's main row follows its production line, and the
         cut for review lives on the line's station, so it is exempt */
      const { data } = await db
        .from("order_deliverables")
        .select("id, status, category, edit_type, order_id, project_id, cycle_id")
        .in("status", ["ready", "approved"])
        .is("video_url", null)
        .is("cancelled_at", null);
      /* a batch is the brief for its shorts and never has a cut of its own */
      const rows = ((data ?? []) as Row[]).filter(
        (r) => r.category !== "main" && !isBatch((r.edit_type as string | null) ?? null),
      );
      if (!rows.length) return { count: 0, sample: [] };
      /* the demo account's props are approved with no file on purpose; the
         owner is found the way the sync finds it, through whichever of the
         three the video hangs off */
      const { data: internal } = await db.from("customers").select("id, email").eq("internal", true);
      const demoIds = new Set(((internal ?? []) as Row[]).map((c) => String(c.id)));
      const demoEmails = new Set(((internal ?? []) as Row[]).map((c) => String(c.email ?? "").toLowerCase()));
      const kept: Row[] = [];
      for (const r of rows) {
        const owner = demoIds.size ? await videoOwner(db, r) : null;
        const demo =
          owner !== null &&
          ((owner.customerId !== null && demoIds.has(owner.customerId)) ||
            (owner.email !== null && demoEmails.has(owner.email.toLowerCase())));
        if (!demo) kept.push(r);
      }
      return tally(kept, (r) => `${short(r.id)} ${String(r.status)}`);
    },
  },
  {
    key: "order_paid_no_videos",
    rule: "A paid order for videos has its videos, an hour after settling.",
    severity: "error",
    run: async (db) => {
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { data: orders } = await db
        .from("orders")
        .select("id, paid_at, product:products(sku, metadata)")
        .eq("status", "paid")
        .lt("paid_at", hourAgo);
      const candidates = ((orders ?? []) as Row[]).filter((o) => {
        const meta = ((o.product as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
        return !meta.invoice && !meta.demo && meta.kind !== "editing_credits";
      });
      if (!candidates.length) return { count: 0, sample: [] };
      const { data: vids } = await db
        .from("order_deliverables")
        .select("order_id")
        .in("order_id", candidates.map((o) => String(o.id)));
      const has = new Set(((vids ?? []) as Row[]).map((v) => String(v.order_id)));
      const bad = candidates.filter((o) => !has.has(String(o.id))).map((o) => short(o.id));
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "account_no_handle",
    rule: "Every account has a handle, so every board has a URL for it.",
    severity: "warn",
    run: async (db) => {
      const { data } = await db.from("customers").select("email").is("slug", null);
      return tally(data, (r) => String(r.email));
    },
  },
  {
    key: "account_email_case",
    rule: "Account emails are stored lowercase, so every join by email holds.",
    severity: "error",
    run: async (db) => {
      const { data } = await db.from("customers").select("email");
      const bad = ((data ?? []) as Row[]).map((r) => String(r.email)).filter((e) => e !== e.toLowerCase());
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "work_without_account",
    rule: "Every order, project, plan and invoice belongs to an account that exists.",
    severity: "error",
    run: async (db) => {
      const [{ data: cs }, { data: os }, { data: ps }, { data: ss }, { data: is }] = await Promise.all([
        db.from("customers").select("email"),
        db.from("orders").select("customer_email"),
        db.from("projects").select("customer_email"),
        db.from("subscriptions").select("customer_email"),
        db.from("invoices").select("customer_email, status").neq("status", "void"),
      ]);
      const known = new Set(((cs ?? []) as Row[]).map((c) => String(c.email).toLowerCase()));
      const bad = new Set<string>();
      for (const rows of [os, ps, ss, is])
        for (const r of (rows ?? []) as Row[]) {
          const e = String(r.customer_email ?? "").toLowerCase();
          if (e && !known.has(e)) bad.add(e);
        }
      return { count: bad.size, sample: [...bad].slice(0, SAMPLE) };
    },
  },
  {
    key: "account_no_login",
    rule: "Every account with paid work can sign in to its portal.",
    severity: "warn",
    run: async (db) => {
      const [{ data: cs }, { data: os }, { data: ss }, { data: ps }] = await Promise.all([
        db.from("customers").select("email, internal"),
        db.from("orders").select("customer_email").eq("status", "paid"),
        db.from("subscriptions").select("customer_email"),
        db.from("projects").select("customer_email").neq("status", "cancelled"),
      ]);
      const withWork = new Set<string>();
      for (const rows of [os, ss, ps])
        for (const r of (rows ?? []) as Row[]) withWork.add(String(r.customer_email ?? "").toLowerCase());
      const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
      const logins = new Set((users?.users ?? []).map((u) => String(u.email ?? "").toLowerCase()));
      const bad = ((cs ?? []) as Row[])
        .map((c) => String(c.email).toLowerCase())
        .filter((e) => withWork.has(e) && !logins.has(e));
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "project_account_link",
    rule: "Every project is linked to the account whose email it carries.",
    severity: "warn",
    run: async (db) => {
      const [{ data: cs }, { data: ps }] = await Promise.all([
        db.from("customers").select("id, email"),
        db.from("projects").select("id, title, customer_email, customer_id"),
      ]);
      const idByEmail = new Map(((cs ?? []) as Row[]).map((c) => [String(c.email).toLowerCase(), String(c.id)]));
      const bad = ((ps ?? []) as Row[])
        .filter((p) => {
          const want = idByEmail.get(String(p.customer_email).toLowerCase());
          return want && p.customer_id !== want;
        })
        .map((p) => String(p.title));
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "retainer_month_missing",
    rule: "A job under a partnership says which month it counts in, and only partners have one.",
    severity: "warn",
    run: async (db) => {
      const [{ data: cs }, { data: ps }] = await Promise.all([
        db.from("customers").select("email, retainer"),
        db.from("projects").select("title, customer_email, retainer_kind, retainer_month"),
      ]);
      const partner = new Set(
        ((cs ?? []) as Row[])
          .filter((c) => parseRetainer(c.retainer) !== null)
          .map((c) => String(c.email).toLowerCase()),
      );
      const bad: string[] = [];
      for (const p of (ps ?? []) as Row[]) {
        if (!p.retainer_kind) continue;
        if (!p.retainer_month) bad.push(`${String(p.title)} has no month`);
        else if (!partner.has(String(p.customer_email).toLowerCase()))
          bad.push(`${String(p.title)} is under a partnership its client does not have`);
      }
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "bell_dead_link",
    rule: "Every client notification opens a section the portal has.",
    severity: "warn",
    run: async (db) => {
      const { data } = await db
        .from("notifications")
        .select("id, href, created_at")
        .eq("audience", "customer")
        .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
      const heads = new Set<string>(PORTAL_SECTIONS as readonly string[]);
      const bad = ((data ?? []) as Row[])
        .filter((n) => n.href && !heads.has(String(n.href).replace(/^\/?portal\//, "").split("/")[0]))
        .map((n) => `${short(n.id)} -> ${String(n.href)}`);
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
  {
    key: "section_override_unknown",
    rule: "A portal switch names a section that exists.",
    severity: "warn",
    run: async (db) => {
      const { data } = await db.from("customers").select("email, hidden_sections, disabled_sections");
      const bad: string[] = [];
      for (const c of (data ?? []) as Row[]) {
        const keys = [
          ...((c.hidden_sections as string[] | null) ?? []),
          ...((c.disabled_sections as string[] | null) ?? []),
        ];
        const unknown = keys.filter((k) => !HIDEABLE_KEYS.has(k));
        if (unknown.length) bad.push(`${String(c.email)}: ${unknown.join(", ")}`);
      }
      return { count: bad.length, sample: bad.slice(0, SAMPLE) };
    },
  },
];

function tally(rows: unknown, label: (r: Row) => string): { count: number; sample: string[] } {
  const list = (rows ?? []) as Row[];
  return { count: list.length, sample: list.slice(0, SAMPLE).map(label) };
}

/** Run every check. A check that throws is reported as a failure of its own, never skipped silently. */
export async function runInvariants(db: DB): Promise<InvariantResult[]> {
  const out: InvariantResult[] = [];
  for (const c of CHECKS) {
    try {
      const r = await c.run(db);
      out.push({ key: c.key, rule: c.rule, severity: c.severity, ...r });
    } catch (e) {
      out.push({
        key: c.key,
        rule: c.rule,
        severity: "error",
        count: 1,
        sample: [`check failed: ${e instanceof Error ? e.message : String(e)}`],
      });
    }
  }
  return out;
}

/** The alarm text for a failing check, in the owner's words. */
export function invariantMessage(r: InvariantResult): string {
  const where = r.sample.length ? ` For example: ${r.sample.join("; ")}.` : "";
  return `${r.rule} That is false for ${r.count} ${r.count === 1 ? "row" : "rows"}.${where}`;
}
