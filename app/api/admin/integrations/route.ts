import { NextResponse } from "next/server";
import { adminRole, verifyAdmin } from "@/lib/checkout/admin-auth";

export const runtime = "nodejs";

/*
 * Integration status for the admin Settings screen: which services are
 * connected, read from the environment at request time. Booleans and modes
 * only; no key material ever leaves the server. Admin role required, same
 * gate as the Team screen.
 */
export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await adminRole(auth.email)) !== "admin")
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });

  const has = (k: string) => Boolean(process.env[k]?.trim());
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

  return NextResponse.json({
    integrations: {
      stripe: {
        configured: has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET"),
        mode: stripeKey.startsWith("sk_live_") ? "live" : stripeKey ? "test" : null,
      },
      supabase: {
        configured: has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
      },
      highlevel: {
        configured: has("HIGHLEVEL_API_TOKEN") && has("HIGHLEVEL_LOCATION_ID"),
      },
      /* the server key drives the partner portal; the public one is what
         puts the click tracker on the page. Either missing is a half
         connected programme, so both have to be there to call it on. */
      affixo: {
        configured: has("AFFIXO_API_KEY") && has("NEXT_PUBLIC_AFFIXO_KEY"),
      },
      brevo: {
        configured: has("BREVO_API_KEY"),
        from: process.env.EMAIL_FROM ?? "hi@ghlvideo.com",
      },
      regionGate: { configured: has("ACCESS_BYPASS_KEY") },
    },
    adminAlertEmail: process.env.ADMIN_ALERT_EMAIL ?? "hi@ghlvideo.com",
  });
}

/* Send a test email to the signed-in admin, so Brevo can be verified from
 * the screen instead of by waiting for a real order. */
export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await adminRole(auth.email)) !== "admin")
    return NextResponse.json({ error: "Admin role required." }, { status: 403 });

  const [{ sendEmail }, { wrapEmail }] = await Promise.all([
    import("@/lib/email/send"),
    import("@/lib/email/templates"),
  ]);
  const result = await sendEmail({
      log: { source: "test" },
    to: auth.email,
    toName: null,
    subject: "Test email from your admin",
    html: wrapEmail(
      `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#EEF0F6;">This is a test send from the admin Settings screen.</p>
       <p style="margin:0;font-size:16px;line-height:1.6;color:#9096A8;">If you are reading this, Brevo is connected and client emails will go out.</p>`,
    ),
  });
  if (!result.ok)
    return NextResponse.json(
      { error: result.error || "Send failed. Check BREVO_API_KEY in Vercel." },
      { status: 502 },
    );
  return NextResponse.json({ ok: true });
}
