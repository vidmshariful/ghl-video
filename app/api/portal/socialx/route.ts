import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { resolvePortalContext } from "@/lib/account-team";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * A portal client asking for their personal SocialX code (the extra 10% on
 * top of the SocialX site pricing). Until SocialX issues codes on its own,
 * this drops the request into the existing pipeline: a HighLevel lead with
 * its own tag, a team bell note, a team email, and a bell note back to the
 * client saying the code is on its way. The team sends the code by hand.
 */
export async function POST(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx)
    return NextResponse.json({ error: "Unauthorized." }, { status: ctx.failStatus });
  if (!ctx.isOwner)
    return NextResponse.json(
      { error: "The account owner requests the code." },
      { status: 403 },
    );
  const email = ctx.ownerEmail;

  const rl = rateLimit(`socialx:${email}`, 3, 600_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Already requested. Give us a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const message = String(body.message ?? "").trim().slice(0, 1000);

  const { data: customer } = await db
    .from("customers")
    .select("name, company")
    .ilike("email", email)
    .maybeSingle();
  const name = (customer?.name as string | null) ?? email;

  // the lead lands in the CRM where the team already works; fail-soft
  try {
    const { syncLeadToHighLevel } = await import("@/lib/checkout/highlevel");
    await syncLeadToHighLevel({
      email,
      name,
      company: (customer?.company as string | null) ?? undefined,
      tags: ["socialx-portal-request"],
      note: [
        "SocialX code request from the customer portal",
        "Wants the extra 10% portal code on top of SocialX site pricing.",
        message ? `Notes: ${message}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      opportunityName: `SocialX: ${(customer?.company as string | null) || name}`,
    });
  } catch (e) {
    console.error("[socialx] HL sync failed:", e instanceof Error ? e.message : e);
  }

  const { pushAdminNotifications, pushNotification } = await import("@/lib/notifications");
  await pushAdminNotifications(db, {
    kind: "socialx_request",
    title: "SocialX code request",
    body: `${name} (${email}) wants their 10% code.${message ? ` Notes: ${message.slice(0, 80)}` : ""}`,
    href: "customers",
  });
  await pushNotification(db, {
    audience: "customer",
    email,
    kind: "socialx_request",
    title: "Your SocialX code is on the way",
    body: "We send it to your email personally, usually within a day.",
    ownerOnly: true,
  });

  // team email alert; fail-soft
  try {
    const [{ sendEmail }, { wrapEmail, escapeHtml }] = await Promise.all([
      import("@/lib/email/send"),
      import("@/lib/email/templates"),
    ]);
    await sendEmail({
      to: process.env.ADMIN_ALERT_EMAIL ?? "hi@ghlvideo.com",
      toName: null,
      subject: `SocialX code request: ${name}`,
      html: wrapEmail(
        `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#EEF0F6;"><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) asked for their SocialX 10% code from the portal.</p>
         <p style="margin:0;font-size:15px;line-height:1.6;color:#9096A8;">${message ? escapeHtml(message) : "No extra notes."} Send the code to their email; the lead is tagged socialx-portal-request in HighLevel.</p>`,
      ),
    });
  } catch (e) {
    console.error("[socialx] alert email failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true });
}
