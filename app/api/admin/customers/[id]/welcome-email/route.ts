import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { addMember } from "@/lib/account-team";
import { ensureAuthAccount } from "@/lib/checkout/account";
import { sendPortalWelcomeEmail, sendTeamInviteEmail } from "@/lib/email/notify";

export const runtime = "nodejs";

/*
 * The welcome email, fired by hand from a customer's record.
 *
 * Accounts the studio creates itself (a deal closed on a call, a client
 * built from the CRM) never pass through checkout, so nothing ever told
 * those people their portal exists. This closes that gap.
 *
 * Two shapes, decided by who the recipient is:
 *  - the account email gets the portal welcome
 *  - a contact gets portal access first (a team seat under the account,
 *    everything switched on; the owner can trim it in Settings, Team) and
 *    then the same invite email an owner-added teammate gets
 *
 * The recipient must be the account's own email or one of its contacts.
 * This is a welcome button, not a general send-anything tool.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { email?: string };
  const to = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!to) return NextResponse.json({ error: "Who should get it?" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: customer } = await db
    .from("customers")
    .select("id, email, name, company")
    .eq("id", id)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const owner = String(customer.email).toLowerCase();
  const ownerName =
    (customer.name as string | null) ?? (customer.company as string | null) ?? owner;

  if (to === owner) {
    /* their login exists from this moment, so "Set it by email" on the
       sign-in page works the second the email lands */
    await ensureAuthAccount(owner);
    await sendPortalWelcomeEmail(db, { email: owner, name: ownerName });
    return NextResponse.json({ ok: true, sentTo: owner, asTeammate: false });
  }

  const { data: contacts } = await db
    .from("customer_contacts")
    .select("name, email")
    .eq("customer_id", id);
  const contact = (contacts ?? []).find(
    (c) => String(c.email ?? "").toLowerCase() === to,
  );
  if (!contact)
    return NextResponse.json(
      { error: "That address is not the account email or one of its contacts." },
      { status: 400 },
    );

  /* a contact who cannot sign in gets an invite to an empty screen, so the
     seat comes first. Already on the team is fine: we just send again. */
  const added = await addMember(db, "customer", owner, {
    name: String(contact.name ?? to),
    email: to,
    features: null,
  });
  if (!added.ok && !/already on your team/i.test(added.error))
    return NextResponse.json({ error: added.error }, { status: 400 });

  await sendTeamInviteEmail(db, {
    accountType: "customer",
    ownerName,
    memberName: String(contact.name ?? ""),
    memberEmail: to,
  });
  return NextResponse.json({
    ok: true,
    sentTo: to,
    asTeammate: true,
    granted: added.ok,
  });
}
