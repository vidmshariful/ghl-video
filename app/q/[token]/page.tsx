import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { publicQuote } from "@/lib/quote-flow";
import { QuoteActions } from "./QuoteActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your quote",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });

function dateLabel(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/*
 * The quote, as the client reads it: what the work is, what it includes,
 * what it costs, and one place to say yes. Sent by email from admin; the
 * token in the link is the key. Accepting books the project in.
 */
export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();
  const db = supabaseAdmin();
  const { data } = await db.from("quotes").select("*").eq("token", token).maybeSingle();
  if (!data || data.status === "draft" || data.status === "void") notFound();
  const q = publicQuote(data as Record<string, unknown>);

  const badge =
    q.status === "accepted"
      ? { label: "Accepted", cls: "border-green/40 text-green" }
      : q.status === "declined"
        ? { label: "Declined", cls: "border-hair text-dim" }
        : q.open
          ? { label: "Open", cls: "border-gold/40 text-gold" }
          : { label: "Expired", cls: "border-hair text-dim" };

  return (
    <div className="min-h-screen bg-canvas px-5 py-10 text-ink md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="font-display text-body font-bold">
            GHL <span className="text-gradient">VIDEO</span>
          </Link>
          <span className="font-mono text-label uppercase tracking-[0.14em] text-dim">Quote</span>
        </div>

        <div className="overflow-hidden rounded-card border border-hair bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-6 py-5">
            <div>
              <h1 className="font-display text-h3 text-ink">{q.title}</h1>
              <p className="mt-1 font-mono text-label uppercase text-dim">
                {q.number} / Sent {dateLabel(q.sentAt ?? q.createdAt)}
                {q.validUntil ? ` / Good until ${dateLabel(q.validUntil)}` : ""}
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 font-mono text-label uppercase ${badge.cls}`}>{badge.label}</span>
          </div>

          <div className="grid gap-6 px-6 py-5 sm:grid-cols-2">
            <div>
              <p className="font-mono text-label uppercase text-dim">From</p>
              <p className="mt-2 text-body font-semibold text-ink">GHL Video</p>
              <p className="text-body-sm text-muted">A brand of Vidiosa LLC</p>
              <p className="text-body-sm text-muted">hi@ghlvideo.com</p>
            </div>
            <div>
              <p className="font-mono text-label uppercase text-dim">Prepared for</p>
              {q.customerName ? <p className="mt-2 text-body font-semibold text-ink">{q.customerName}</p> : null}
              {q.customerCompany ? <p className="text-body-sm text-muted">{q.customerCompany}</p> : null}
              <p className="text-body-sm text-muted">{q.customerEmail}</p>
            </div>
          </div>

          <div className="px-6 pb-2">
            <div className="overflow-hidden rounded-[8px] border border-hair">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-hair bg-canvas">
                    <th className="px-4 py-2.5 font-mono text-label uppercase text-dim">What</th>
                    <th className="px-4 py-2.5 text-right font-mono text-label uppercase text-dim">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.lineItems.map((li, i) => (
                    <tr key={i} className="border-b border-hair last:border-b-0">
                      <td className="px-4 py-3 text-body text-ink">
                        {li.description}
                        {li.quantity > 1 ? (
                          <span className="mt-0.5 block font-mono text-label uppercase text-dim">
                            {li.quantity} &times; {money(li.unitCents)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-body text-ink [font-variant-numeric:tabular-nums]">{money(li.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {q.discountKind && q.subtotalCents !== q.totalCents ? (
                    <>
                      <tr className="border-b border-hair">
                        <td className="px-4 py-2.5 font-mono text-label uppercase text-muted">Subtotal</td>
                        <td className="px-4 py-2.5 text-right font-mono text-body text-muted [font-variant-numeric:tabular-nums]">{money(q.subtotalCents)}</td>
                      </tr>
                      <tr className="border-b border-hair">
                        <td className="px-4 py-2.5 font-mono text-label uppercase text-muted">
                          Discount{q.discountKind === "percent" && q.discountValue ? ` (${q.discountValue}%)` : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-body text-green [font-variant-numeric:tabular-nums]">
                          &minus;{money(q.subtotalCents - q.totalCents)}
                        </td>
                      </tr>
                    </>
                  ) : null}
                  <tr className="bg-canvas">
                    <td className="px-4 py-3 font-mono text-label uppercase text-muted">Total</td>
                    <td className="px-4 py-3 text-right font-display text-h4 text-ink [font-variant-numeric:tabular-nums]">{money(q.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {q.scope ? (
            <div className="px-6 py-4">
              <p className="font-mono text-label uppercase text-dim">What is included</p>
              <p className="mt-2 whitespace-pre-wrap text-body-sm text-muted">{q.scope}</p>
            </div>
          ) : null}

          <div className="border-t border-hair px-6 py-6">
            {q.status === "accepted" ? (
              <div className="rounded-[8px] border border-green/30 bg-green/[0.06] px-5 py-4">
                <p className="font-display text-h4 text-ink">Accepted</p>
                <p className="mt-1 text-body-sm text-muted">
                  By {q.acceptedBy} on {dateLabel(q.acceptedAt)}. The work is booked in; the invoice follows by email.
                </p>
              </div>
            ) : q.status === "declined" ? (
              <p className="text-body text-muted">Declined on {dateLabel(q.declinedAt)}. If a different scope would work, reply to the email.</p>
            ) : q.open ? (
              <QuoteActions token={token} totalLabel={money(q.totalCents)} />
            ) : (
              <p className="text-body text-muted">This quote has passed its date. Reply to the email and we will refresh it.</p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-label uppercase text-dim">Questions? hi@ghlvideo.com</p>
      </div>
    </div>
  );
}
