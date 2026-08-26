import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/account/session";
import { memberCan, sanitizeFeatures } from "@/lib/team-features";

/*
 * Team members for the customer and partner portals: the rows, the CRUD the
 * owners use from Settings, and the request-context resolver every portal
 * API goes through. A member signs in with their own account; the client
 * sends `X-Act-For: <owner email>` and the server admits them only if an
 * account_members row says so, feature by feature. Owners never need the
 * header; their own email is the account.
 */

export type AccountType = "customer" | "partner";

export type MemberRow = {
  id: string;
  account_type: AccountType;
  owner_email: string;
  member_email: string;
  member_name: string | null;
  features: string[] | null;
  status: "invited" | "active" | "paused";
  created_at: string;
};

export const TEAM_MEMBER_CAP = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MEMBER_FIELDS =
  "id, account_type, owner_email, member_email, member_name, features, status, created_at";

/* ---------------- CRUD (owner-only; the routes enforce that) ---------------- */

export async function listMembers(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
): Promise<MemberRow[]> {
  const { data } = await db
    .from("account_members")
    .select(MEMBER_FIELDS)
    .eq("account_type", accountType)
    .eq("owner_email", ownerEmail.toLowerCase())
    .order("created_at", { ascending: true });
  return (data ?? []) as MemberRow[];
}

export async function addMember(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  input: { name: string; email: string; features: unknown },
): Promise<{ ok: true; member: MemberRow } | { ok: false; error: string }> {
  const owner = ownerEmail.toLowerCase();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "The teammate's name is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "A valid email is required." };
  if (email === owner)
    return { ok: false, error: "That is the account email itself. Add a different person." };

  const existing = await listMembers(db, accountType, owner);
  if (existing.length >= TEAM_MEMBER_CAP)
    return { ok: false, error: `You can have up to ${TEAM_MEMBER_CAP} team members.` };

  // their login exists from day one; they set a password from the sign-in page
  const { ensureAuthAccount } = await import("@/lib/checkout/account");
  await ensureAuthAccount(email);

  const { data, error } = await db
    .from("account_members")
    .insert({
      account_type: accountType,
      owner_email: owner,
      member_email: email,
      member_name: name,
      features: sanitizeFeatures(accountType, input.features),
    })
    .select(MEMBER_FIELDS)
    .single();
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "That person is already on your team." };
    console.error("[team] add failed:", error.message);
    return { ok: false, error: "Could not add them. Try again." };
  }
  return { ok: true, member: data as MemberRow };
}

export async function updateMember(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  id: string,
  patch: { name?: string; features?: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = String(patch.name).trim().slice(0, 120);
    if (!name) return { ok: false, error: "The teammate's name is required." };
    row.member_name = name;
  }
  if (patch.features !== undefined) row.features = sanitizeFeatures(accountType, patch.features);
  if (Object.keys(row).length === 0) return { ok: true };
  const { error } = await db
    .from("account_members")
    .update(row)
    .eq("id", id)
    .eq("account_type", accountType)
    .eq("owner_email", ownerEmail.toLowerCase());
  if (error) {
    console.error("[team] update failed:", error.message);
    return { ok: false, error: "Could not save. Try again." };
  }
  return { ok: true };
}

export async function removeMember(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  id: string,
): Promise<void> {
  await db
    .from("account_members")
    .delete()
    .eq("id", id)
    .eq("account_type", accountType)
    .eq("owner_email", ownerEmail.toLowerCase());
}

/** One member row by id, scoped to the owner (for resend and status flips). */
export async function getMember(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  id: string,
): Promise<MemberRow | null> {
  const { data } = await db
    .from("account_members")
    .select(MEMBER_FIELDS)
    .eq("id", id)
    .eq("account_type", accountType)
    .eq("owner_email", ownerEmail.toLowerCase())
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

/** Pause locks a member out while keeping their row; resume lets them back
 *  in. Only active members pause; only paused ones resume. */
export async function setMemberStatus(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  id: string,
  action: "pause" | "resume",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await getMember(db, accountType, ownerEmail, id);
  if (!member) return { ok: false, error: "That teammate is no longer on your team." };
  if (action === "pause" && member.status !== "active")
    return { ok: false, error: "Only an active teammate can be paused." };
  if (action === "resume" && member.status !== "paused")
    return { ok: false, error: "That teammate is not paused." };
  const { error } = await db
    .from("account_members")
    .update({ status: action === "pause" ? "paused" : "active" })
    .eq("id", id);
  if (error) {
    console.error("[team] status change failed:", error.message);
    return { ok: false, error: "Could not save. Try again." };
  }
  return { ok: true };
}

/* ---------------- membership lookups ---------------- */

export async function membershipsForMember(
  db: SupabaseClient,
  accountType: AccountType,
  memberEmail: string,
): Promise<MemberRow[]> {
  const { data } = await db
    .from("account_members")
    .select(MEMBER_FIELDS)
    .eq("account_type", accountType)
    .eq("member_email", memberEmail.toLowerCase())
    .order("created_at", { ascending: true });
  return (data ?? []) as MemberRow[];
}

async function membershipFor(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  memberEmail: string,
): Promise<MemberRow | null> {
  const { data } = await db
    .from("account_members")
    .select(MEMBER_FIELDS)
    .eq("account_type", accountType)
    .eq("owner_email", ownerEmail.toLowerCase())
    .eq("member_email", memberEmail.toLowerCase())
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

/** First member-context use flips invited to active, so the owner can see
 *  the invite landed. Fail-soft. */
async function activateMembership(db: SupabaseClient, m: MemberRow): Promise<void> {
  if (m.status !== "invited") return;
  await db.from("account_members").update({ status: "active" }).eq("id", m.id);
}

/**
 * Everyone a portal event should reach: the owner plus every member whose
 * grants include the feature (undefined feature = the whole team).
 *
 * INVITED MEMBERS COUNT (owner decision, 26 August 2026). They used to be
 * skipped until they had signed in once, which meant a client could add
 * three people in the morning and none of them heard anything until each
 * happened to log in, about work that was already moving. Being invited is
 * the decision; access starts there. Only a PAUSED member is silenced,
 * because pausing is the deliberate act of taking access away.
 *
 * The status still reads Invited until first use, so the owner and the
 * studio can both see who has actually turned up.
 */
export async function teamRecipients(
  db: SupabaseClient,
  accountType: AccountType,
  ownerEmail: string,
  feature?: string,
): Promise<string[]> {
  const owner = ownerEmail.toLowerCase();
  try {
    const members = await listMembers(db, accountType, owner);
    const extra = members
      .filter((m) => m.status !== "paused")
      .filter((m) => (feature ? memberCan(m.features, feature) : true))
      .map((m) => m.member_email)
      /* an owner who is also listed as a member would otherwise get two */
      .filter((e) => e.toLowerCase() !== owner);
    return [owner, ...new Set(extra)];
  } catch {
    return [owner];
  }
}

/* ---------------- request context ---------------- */

export type PortalContext = {
  /* the account whose data is being read: the owner's email */
  ownerEmail: string;
  /* the signed-in person */
  selfEmail: string;
  isOwner: boolean;
  /* null = everything (owner, or a member with full access) */
  features: string[] | null;
  /* staff looking at a client's portal rather than working in it */
  viewingAsAdmin?: boolean;
};

export function contextCan(ctx: PortalContext, feature: string): boolean {
  return ctx.isOwner || memberCan(ctx.features, feature);
}

/* what View as client is allowed to do: look, and nothing else */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/*
 * Is this a studio email? Read whole and compared case-insensitively, the
 * same way lib/checkout/admin-auth.ts does it, because the allowlist is a
 * handful of rows and the RLS is_admin() function folds case too.
 */
async function isStaff(db: SupabaseClient, email: string): Promise<boolean> {
  const { data } = await db.from("admins").select("email");
  return (data ?? []).some((r) => (r.email ?? "").toLowerCase() === email.toLowerCase());
}

/**
 * Resolve who is acting on which account. Without X-Act-For (or with their
 * own email) the caller is the owner of their own account. With it, the
 * caller must hold a membership row for that owner; invited flips to
 * active on first use.
 */
export async function resolvePortalContext(
  db: SupabaseClient,
  req: Request,
  accountType: AccountType,
): Promise<PortalContext | { failStatus: 401 | 403 }> {
  const user = await getSessionUser(req);
  if (!user) return { failStatus: 401 };
  const actFor = req.headers.get("x-act-for")?.trim().toLowerCase() || null;

  if (!actFor || actFor === user.email) {
    return { ownerEmail: user.email, selfEmail: user.email, isOwner: true, features: null };
  }

  const membership = await membershipFor(db, accountType, actFor, user.email);
  if (!membership || membership.status === "paused") {
    /*
     * View as client.
     *
     * Staff open a client's portal to see exactly what the client sees.
     * Deliberately NOT done by adding ourselves to their team: that writes a
     * row on their account, puts a studio email in the team list they read,
     * spends one of their ten seats, and has to be remembered and removed.
     * This leaves no trace on the client at all.
     *
     * Reads only, and gated here rather than route by route. A studio person
     * browsing a client's portal must not be able to approve a video, send a
     * message or brief a project as them by accident, and one gate is also
     * one thing to keep right as portal routes get added.
     */
    if (!(await isStaff(db, user.email))) return { failStatus: 403 };
    if (!READ_ONLY_METHODS.has(req.method.toUpperCase())) return { failStatus: 403 };
    return {
      ownerEmail: actFor,
      selfEmail: user.email,
      isOwner: false,
      features: null,
      viewingAsAdmin: true,
    };
  }
  await activateMembership(db, membership);
  return {
    ownerEmail: membership.owner_email,
    selfEmail: user.email,
    isOwner: false,
    features: membership.features,
  };
}
