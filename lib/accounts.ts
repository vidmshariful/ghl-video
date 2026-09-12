import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAuthAccount, type EnsureAccountResult } from "@/lib/checkout/account";
import { freeSlug, slugStem } from "@/lib/account-slug";

/*
 * One door for every customer, whichever way they arrive.
 *
 * Six code paths used to write customer rows six different ways: checkout
 * with a name and company, the Stripe webhook with a bare email, admin with
 * no login, the manual order with a login but no welcome, the invoice
 * screen with nothing at all. The result was accounts with no slug (so the
 * editing board had no URL for them), accounts with no login (so the portal
 * welcome pointed at a door that did not open), and names lost because a
 * later path overwrote an earlier one with null.
 *
 * Every path calls this now (owner decision, 12 September 2026). It:
 *   - finds the row case-insensitively or creates it with a handle,
 *   - fills in anything missing and never blanks anything present,
 *   - makes sure the portal login exists, with the password chosen at
 *     checkout when there is one (see lib/checkout/account.ts for why a
 *     password is only ever set on create),
 *   - sends the portal welcome once, and only through the doors that have
 *     no other email covering it: checkout has the order confirmation, a
 *     plan has "your plan is live", an invoice has the invoice itself.
 *
 * Never throws for a bad email on a paid path: callers validate first, and
 * the one thing this must not do is fail an order after money moved.
 */

export type AccountDoor =
  | "checkout"
  | "plan-checkout"
  | "stripe"
  | "admin"
  | "enquiry"
  | "invoice"
  | "manual-order";

/* doors whose own email already says "here is your portal" */
const WELCOME_COVERED: ReadonlySet<AccountDoor> = new Set(["checkout", "plan-checkout", "stripe", "invoice"]);

export type EnsureAccountInput = {
  email: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  highlevelContactId?: string | null;
  source: AccountDoor;
  /** the password typed at checkout, applied only if this call creates the login */
  password?: string | null;
  /** false to hold the welcome back (a screen that sends its own) */
  welcome?: boolean;
};

export type EnsuredAccount = {
  id: string;
  email: string;
  slug: string | null;
  /** true only when this call made the customer row */
  created: boolean;
  login: EnsureAccountResult;
  /** true when the portal welcome went out on this call */
  welcomed: boolean;
};

type Row = Record<string, unknown>;

const clean = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function ensureAccount(
  db: SupabaseClient,
  input: EnsureAccountInput,
): Promise<EnsuredAccount | null> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  const name = clean(input.name, 160);
  const company = clean(input.company, 160);
  const phone = clean(input.phone, 40);
  const hl = clean(input.highlevelContactId, 120);

  const { data: existing } = await db
    .from("customers")
    .select("id, email, name, company, phone, slug, highlevel_contact_id, welcomed_at")
    .ilike("email", email)
    .maybeSingle();

  let row: Row;
  let created = false;

  if (existing) {
    /* fill the gaps, never overwrite: a later, thinner path (the webhook
       with a bare email) must not erase what checkout collected */
    const patch: Row = {};
    if (!existing.name && name) patch.name = name;
    if (!existing.company && company) patch.company = company;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.highlevel_contact_id && hl) patch.highlevel_contact_id = hl;
    if (!existing.slug) patch.slug = await nextSlug(db, company ?? (existing.company as string | null), name ?? (existing.name as string | null), email);
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await db.from("customers").update(patch).eq("id", String(existing.id));
    }
    row = { ...existing, ...patch };
  } else {
    const slug = await nextSlug(db, company, name, email);
    const { data: made, error } = await db
      .from("customers")
      .insert({ email, name, company, phone, highlevel_contact_id: hl, slug, source: input.source })
      .select("id, email, name, company, phone, slug, welcomed_at")
      .single();
    if (error || !made) {
      /* two checkouts for the same new email at once: the loser re-reads */
      const { data: again } = await db
        .from("customers")
        .select("id, email, name, company, phone, slug, welcomed_at")
        .ilike("email", email)
        .maybeSingle();
      if (!again) {
        console.error(`[accounts] could not create ${email}: ${error?.message ?? "no row"}`);
        return null;
      }
      row = again;
    } else {
      row = made;
      created = true;
    }
  }

  /* the login, so the portal door opens the moment they are told about it */
  const login = await ensureAuthAccount(email, input.password ?? null);

  let welcomed = false;
  if (input.welcome !== false && !WELCOME_COVERED.has(input.source) && !row.welcomed_at) {
    /* an account that already has work has already been told: a manual
       order for an old premade buyer is not their first day */
    const fresh = created || !(await hasAnyWork(db, email));
    if (fresh) {
      try {
        const { sendPortalWelcomeEmail } = await import("@/lib/email/notify");
        await sendPortalWelcomeEmail(db, {
          email,
          name: (row.name as string | null) ?? (row.company as string | null) ?? null,
        });
        await db
          .from("customers")
          .update({ welcomed_at: new Date().toISOString() })
          .eq("id", String(row.id));
        welcomed = true;
      } catch (e) {
        console.error(`[accounts] welcome to ${email} failed: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  return {
    id: String(row.id),
    email,
    slug: (row.slug as string | null) ?? null,
    created,
    login,
    welcomed,
  };
}

/** The first free handle on the stem this account would take. */
async function nextSlug(
  db: SupabaseClient,
  company: string | null,
  name: string | null,
  email: string,
): Promise<string> {
  const stem = slugStem(company, name, email);
  const { data } = await db.from("customers").select("slug").like("slug", `${stem}%`);
  return freeSlug(
    stem,
    ((data ?? []) as Row[]).map((r) => String(r.slug ?? "")).filter(Boolean),
  );
}

async function hasAnyWork(db: SupabaseClient, email: string): Promise<boolean> {
  const [{ count: orders }, { count: projects }, { count: subs }] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).ilike("customer_email", email),
    db.from("projects").select("id", { count: "exact", head: true }).ilike("customer_email", email),
    db.from("subscriptions").select("id", { count: "exact", head: true }).ilike("customer_email", email),
  ]);
  return (orders ?? 0) + (projects ?? 0) + (subs ?? 0) > 0;
}
