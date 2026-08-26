import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LineItem = {
  description: string;
  amount_cents: number;
  quantity?: number;
  unit_cents?: number;
};
type Invoice = {
  number: string;
  product_sku: string;
  product_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_company: string | null;
  line_items: LineItem[];
  subtotal_cents: number | null;
  discount_kind: "percent" | "flat" | null;
  discount_value: number | null;
  currency: string;
  total_cents: number;
  notes: string | null;
  due_date: string | null;
  status: "open" | "void";
  created_at: string;
  project_ids: string[] | null;
};

const money = (cents: number, cur = "usd") =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: cur.toUpperCase() });

// Format a plain date without a timezone shift (YYYY-MM-DD or ISO).
function dateLabel(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const db = supabaseAdmin();
  const { data } = await db.from("invoices").select("*").eq("token", token).maybeSingle();
  if (!data) notFound();
  const inv = data as Invoice;

  let paidAt: string | null = null;
  if (inv.product_id) {
    const { data: order } = await db
      .from("orders")
      .select("paid_at")
      .eq("product_id", inv.product_id)
      .eq("status", "paid")
      .maybeSingle();
    if (order) paidAt = order.paid_at;
  }
  const paid = !!paidAt;

  /*
   * The jobs this bill is for, by name.
   *
   * The invoice already recorded which custom projects it covered, but only
   * we could see it: the client got a list of line descriptions and no way to
   * tell which of the four things in flight they were paying for. On a
   * retainer account with several projects running at once that is the first
   * question they ask, and it should not need an email to answer.
   */
  let projects: { id: string; title: string; category: string | null }[] = [];
  const projectIds = (inv.project_ids ?? []).filter(Boolean);
  if (projectIds.length) {
    const { data: rows } = await db
      .from("projects")
      .select("id, title, category")
      .in("id", projectIds);
    /* keep the order the invoice recorded, not whatever the database returns */
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    projects = projectIds
      .map((pid) => byId.get(pid))
      .filter(Boolean)
      .map((r) => ({
        id: String((r as Record<string, unknown>).id),
        title: String((r as Record<string, unknown>).title ?? "Project"),
        category: ((r as Record<string, unknown>).category as string | null) ?? null,
      }));
  }

  const badge = paid
    ? { label: "Paid", cls: "border-green/40 text-green" }
    : inv.status === "void"
      ? { label: "Void", cls: "border-hair text-dim" }
      : { label: "Due", cls: "border-gold/40 text-gold" };

  return (
    <div className="min-h-screen bg-canvas px-5 py-10 text-ink md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="font-display text-body font-bold">
            GHL <span className="text-gradient">VIDEO</span>
          </Link>
          <span className="font-mono text-label uppercase tracking-[0.14em] text-dim">Invoice</span>
        </div>

        <div className="overflow-hidden rounded-card border border-hair bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-6 py-5">
            <div>
              <h1 className="font-display text-h3 text-ink">{inv.number}</h1>
              <p className="mt-1 font-mono text-label uppercase text-dim">
                Issued {dateLabel(inv.created_at)}
                {inv.due_date ? ` / Due ${dateLabel(inv.due_date)}` : ""}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 font-mono text-label uppercase ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>

          <div className="grid gap-6 px-6 py-5 sm:grid-cols-2">
            <div>
              <p className="font-mono text-label uppercase text-dim">From</p>
              <p className="mt-2 text-body font-semibold text-ink">GHL Video</p>
              <p className="text-body-sm text-muted">A brand of Vidiosa LLC</p>
              <p className="text-body-sm text-muted">hi@ghlvideo.com</p>
            </div>
            <div>
              <p className="font-mono text-label uppercase text-dim">Billed to</p>
              {inv.customer_name ? (
                <p className="mt-2 text-body font-semibold text-ink">{inv.customer_name}</p>
              ) : null}
              {inv.customer_company ? (
                <p className="text-body-sm text-muted">{inv.customer_company}</p>
              ) : null}
              {inv.customer_email ? (
                <p className="text-body-sm text-muted">{inv.customer_email}</p>
              ) : null}
            </div>
          </div>

          <div className="px-6 pb-2">
            <div className="overflow-hidden rounded-[8px] border border-hair">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-hair bg-canvas">
                    <th className="px-4 py-2.5 font-mono text-label uppercase text-dim">Description</th>
                    <th className="px-4 py-2.5 text-right font-mono text-label uppercase text-dim">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inv.line_items.map((li, i) => (
                    <tr key={i} className="border-b border-hair last:border-b-0">
                      <td className="px-4 py-3 text-body text-ink">
                        {li.description}
                        {/* the sum said out loud, so nobody has to work out
                            why a line costs what it costs */}
                        {li.quantity && li.quantity > 1 && li.unit_cents ? (
                          <span className="mt-0.5 block font-mono text-label uppercase text-dim">
                            {li.quantity} &times; {money(li.unit_cents, inv.currency)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-body text-ink [font-variant-numeric:tabular-nums]">
                        {money(li.amount_cents, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {inv.discount_kind && inv.subtotal_cents ? (
                    <>
                      <tr className="border-b border-hair">
                        <td className="px-4 py-2.5 font-mono text-label uppercase text-muted">
                          Subtotal
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-body text-muted [font-variant-numeric:tabular-nums]">
                          {money(inv.subtotal_cents, inv.currency)}
                        </td>
                      </tr>
                      <tr className="border-b border-hair">
                        <td className="px-4 py-2.5 font-mono text-label uppercase text-muted">
                          Discount
                          {inv.discount_kind === "percent" && inv.discount_value
                            ? ` (${inv.discount_value}%)`
                            : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-body text-green [font-variant-numeric:tabular-nums]">
                          &minus;{money(inv.subtotal_cents - inv.total_cents, inv.currency)}
                        </td>
                      </tr>
                    </>
                  ) : null}
                  <tr className="bg-canvas">
                    <td className="px-4 py-3 font-mono text-label uppercase text-muted">Total</td>
                    <td className="px-4 py-3 text-right font-display text-h4 text-ink [font-variant-numeric:tabular-nums]">
                      {money(inv.total_cents, inv.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {projects.length > 0 ? (
            <div className="px-6 py-4">
              <p className="font-mono text-label uppercase text-dim">
                {projects.length === 1 ? "The project this covers" : "The projects this covers"}
              </p>
              <ul className="mt-3 grid gap-2">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[8px] border border-hair bg-canvas px-4 py-2.5"
                  >
                    <span className="min-w-0 text-body-sm text-ink">{p.title}</span>
                    {p.category ? (
                      <span className="shrink-0 font-mono text-label uppercase text-dim">
                        {p.category}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {inv.notes ? (
            <div className="px-6 py-4">
              <p className="font-mono text-label uppercase text-dim">What is included</p>
              <p className="mt-2 whitespace-pre-wrap text-body-sm text-muted">{inv.notes}</p>
            </div>
          ) : null}

          <div className="border-t border-hair px-6 py-6">
            {paid ? (
              <div className="rounded-[8px] border border-green/30 bg-green/[0.06] px-5 py-4">
                <p className="font-display text-h4 text-ink">Paid</p>
                <p className="mt-1 text-body-sm text-muted">
                  Received on {dateLabel(paidAt)}. Thank you. A receipt was emailed to you.
                </p>
              </div>
            ) : inv.status === "void" ? (
              <p className="text-body text-muted">
                This invoice has been voided. Please contact us if you believe this is a mistake.
              </p>
            ) : (
              <>
                <a
                  href={`/checkout/${inv.product_sku}/`}
                  className="tap inline-flex items-center gap-2 rounded-[3px] bg-brand-gradient px-8 py-3.5 text-body font-semibold text-canvas transition-all hover:brightness-110"
                >
                  Pay {money(inv.total_cents, inv.currency)}
                  <span aria-hidden="true">&rarr;</span>
                </a>
                <p className="mt-3 font-mono text-label uppercase text-dim">
                  Secure checkout, card payment
                </p>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-label uppercase text-dim">
          Questions? hi@ghlvideo.com
        </p>
      </div>
    </div>
  );
}
