import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { sendEmail } from "@/lib/email/send";
import { SITE_URL, renderTemplate } from "@/lib/email/templates";

export const runtime = "nodejs";

/* Sample values so a test send shows a realistic email. */
const SAMPLE: Record<string, string> = {
  customer_name: "Alex",
  product_name: "AI Receptionist + Conversational AI",
  order_code: "FEXP-031",
  update_message: "Your first cut is ready for review. Take a look and send any changes.",
  stage: "In review",
  portal_url: `${SITE_URL}/portal`,
  delivery_url: `${SITE_URL}/portal`,
};

/* Send the current editor subject/body (rendered with sample data) to the
 * signed-in admin, so they can preview a template in a real inbox. */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { subject?: string; body?: string };
  const subject = typeof body.subject === "string" && body.subject ? body.subject : "Test email";
  const html = typeof body.body === "string" ? body.body : "";

  const result = await sendEmail({
    to: admin.email,
    subject: `[Test] ${renderTemplate(subject, SAMPLE)}`,
    html: renderTemplate(html, SAMPLE),
  });
  if (!result.ok) {
    // surface Brevo's actual reason so the real cause is visible, not a guess
    return NextResponse.json({ error: result.error ?? "Send failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, to: admin.email });
}
