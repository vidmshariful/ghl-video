import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "@/lib/notifications-types";
import { NOTIFICATION_DEFAULTS, notifId } from "@/lib/comms";

export type { Audience } from "@/lib/notifications-types";

/*
 * In-portal notifications: the bell in every portal top bar. Rows are written
 * server-side at the same exactly-once points that send the transactional
 * emails (lib/email/notify.ts calls in here), so the bell always matches the
 * inbox. Everything is fail-soft: a notification problem is logged and
 * swallowed, it never breaks the money path.
 *
 * What a bell says is decided here, not at the call site. Every kind has a
 * default in lib/comms.ts, the team can override the words or switch a kind
 * off in admin (notification_templates), and the call site only supplies the
 * facts as `vars`. The literal title a call site passes is the last resort,
 * for a kind nobody has registered yet.
 *
 * Chat messages deliberately do NOT create rows here: chat has its own icon
 * and unread badges, and mirroring every message into the bell would bury
 * the business events this feed exists for.
 */

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type PushInput = {
  audience: Audience;
  email: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  /* the facts this bell can mention; filled into the template's {{variables}} */
  vars?: Record<string, string>;
  /* the team grant this event belongs to; members without it are skipped */
  feature?: string;
  /* personal events (e.g. the invite itself) never fan out to the team */
  ownerOnly?: boolean;
};

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => vars[k.toLowerCase()] ?? "");

/**
 * The words for this bell: the admin's override if there is one, else the
 * registered default, else whatever the call site said. Returns null when the
 * team has switched this kind off for this audience.
 */
async function wording(
  db: SupabaseClient,
  audience: Audience,
  n: { kind: string; title: string; body?: string; vars?: Record<string, string> },
): Promise<{ title: string; body: string | null } | null> {
  type Row = { title: string; body: string | null; enabled: boolean };
  const vars = n.vars ?? {};
  let row: Row | null = null;
  try {
    const { data } = await db
      .from("notification_templates")
      .select("title, body, enabled")
      .eq("audience", audience)
      .eq("kind", n.kind)
      .maybeSingle();
    row = (data as Row | null) ?? null;
  } catch {
    /* a template lookup problem must never cost the event its bell */
  }
  if (row && !row.enabled) return null;
  if (row) return { title: fill(row.title, vars), body: row.body ? fill(row.body, vars) : null };
  const def = NOTIFICATION_DEFAULTS[notifId(audience, n.kind)];
  if (def && n.vars) return { title: fill(def.title, vars), body: def.body ? fill(def.body, vars) : null };
  return { title: n.title, body: n.body ?? null };
}

export async function pushNotification(db: SupabaseClient, n: PushInput): Promise<void> {
  try {
    if (!n.email) return;
    const words = await wording(db, n.audience, n);
    if (!words) return;
    let recipients = [n.email.toLowerCase()];
    // customer and partner accounts can have team members; every recipient
    // gets their own row, so each person has their own read state
    if (!n.ownerOnly && (n.audience === "customer" || n.audience === "partner")) {
      const { teamRecipients } = await import("@/lib/account-team");
      recipients = await teamRecipients(db, n.audience, n.email, n.feature);
    }
    const rows = recipients.map((email) => ({
      audience: n.audience,
      recipient_email: email,
      kind: n.kind,
      title: words.title,
      body: words.body,
      href: n.href ?? null,
    }));
    const { error } = await db.from("notifications").insert(rows);
    if (error) console.error(`[notify] ${n.kind} not stored for ${n.email}:`, error.message);
  } catch (e) {
    console.error(`[notify] ${n.kind} failed:`, e instanceof Error ? e.message : e);
  }
}

/** Fan a team event out to every admin, so each teammate has their own
 *  read state on the bell. */
export async function pushAdminNotifications(
  db: SupabaseClient,
  n: Omit<PushInput, "audience" | "email">,
): Promise<void> {
  try {
    const words = await wording(db, "admin", n);
    if (!words) return;
    const { data } = await db.from("admins").select("email");
    const emails = (data ?? [])
      .map((r) => (r.email as string | null)?.toLowerCase())
      .filter((e): e is string => Boolean(e));
    if (emails.length === 0) return;
    const rows = emails.map((email) => ({
      audience: "admin",
      recipient_email: email,
      kind: n.kind,
      title: words.title,
      body: words.body,
      href: n.href ?? null,
    }));
    const { error } = await db.from("notifications").insert(rows);
    if (error) console.error(`[notify] admin ${n.kind} not stored:`, error.message);
  } catch (e) {
    console.error(`[notify] admin ${n.kind} failed:`, e instanceof Error ? e.message : e);
  }
}

/** The bell's payload: latest 30 plus the unread count. */
export async function listNotifications(
  db: SupabaseClient,
  audience: Audience,
  email: string,
): Promise<{ notifications: NotificationRow[]; unread: number }> {
  const recipient = email.toLowerCase();
  const [{ data }, { count }] = await Promise.all([
    db
      .from("notifications")
      .select("id, kind, title, body, href, read_at, created_at")
      .eq("audience", audience)
      .eq("recipient_email", recipient)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("audience", audience)
      .eq("recipient_email", recipient)
      .is("read_at", null),
  ]);
  return {
    notifications: (data ?? []).map((r) => ({
      id: r.id as string,
      kind: r.kind as string,
      title: r.title as string,
      body: (r.body as string | null) ?? null,
      href: (r.href as string | null) ?? null,
      readAt: (r.read_at as string | null) ?? null,
      createdAt: r.created_at as string,
    })),
    unread: count ?? 0,
  };
}

/** Mark the given ids read, or everything unread when ids is omitted. */
export async function markNotificationsRead(
  db: SupabaseClient,
  audience: Audience,
  email: string,
  ids?: string[],
): Promise<void> {
  let q = db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("audience", audience)
    .eq("recipient_email", email.toLowerCase())
    .is("read_at", null);
  if (ids && ids.length > 0) q = q.in("id", ids);
  const { error } = await q;
  if (error) console.error("[notify] mark read failed:", error.message);
}

/**
 * Tell whoever owns this job, falling back to the whole team when nobody has
 * claimed it. Client feedback landing in one person's bell is the reason
 * orders carry an owner at all; fanning it out to everybody would put us back
 * where a notification is somebody else's problem.
 */
export async function pushOrderOwnerNotification(
  db: SupabaseClient,
  orderId: string,
  n: Omit<PushInput, "audience" | "email">,
): Promise<void> {
  try {
    const { data: order } = await db
      .from("orders")
      .select("assigned_admin_email")
      .eq("id", orderId)
      .maybeSingle();
    const owner = (order?.assigned_admin_email as string | null)?.toLowerCase();
    if (!owner) return pushAdminNotifications(db, n);

    const words = await wording(db, "admin", n);
    if (!words) return;
    const { error } = await db.from("notifications").insert({
      audience: "admin",
      recipient_email: owner,
      kind: n.kind,
      title: words.title,
      body: words.body,
      href: n.href ?? null,
    });
    if (error) console.error(`[notify] owner ${n.kind} not stored:`, error.message);
  } catch (e) {
    console.error(`[notify] owner ${n.kind} failed:`, e instanceof Error ? e.message : e);
  }
}
