/*
 * Quotes: a priced scope the client accepts on our page (owner decision,
 * 14 September 2026). One reading of a quote form, shared by create and
 * edit, with the same money rules as an invoice: every figure is
 * re-derived from the lines, a discount never carries the total below
 * nothing. Import-free, so the tests read the same rules as the routes.
 */

export type QuoteLineItem = { description: string; amount_cents: number; quantity?: number; unit_cents?: number };

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "void";

export type ParsedQuote = {
  customerEmail: string;
  customerName: string;
  customerCompany: string;
  title: string;
  scope: string;
  validUntil: string | null;
  requestId: string | null;
  projectId: string | null;
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  discountKind: "percent" | "flat" | null;
  discountValue: number | null;
  totalCents: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseQuoteInput(body: Record<string, unknown>): { ok: true; quote: ParsedQuote } | { ok: false; error: string } {
  const customerEmail = str(body.customerEmail, 254).toLowerCase();
  if (!customerEmail || !EMAIL_RE.test(customerEmail)) return { ok: false, error: "A valid client email is required." };
  const title = str(body.title, 160);
  if (!title) return { ok: false, error: "Give the quote a title: what the work is." };

  const lineItems: QuoteLineItem[] = (Array.isArray(body.lineItems) ? body.lineItems : [])
    .map((it) => {
      const r = it as Record<string, unknown>;
      const qtyRaw = Math.round(Number(r.quantity));
      const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(999, qtyRaw) : 1;
      const unit = Math.round(Number(r.unitCents ?? r.amountCents));
      return {
        description: str(r.description, 200),
        quantity,
        unit_cents: Number.isFinite(unit) ? unit : 0,
        amount_cents: Number.isFinite(unit) ? unit * quantity : 0,
      };
    })
    .filter((it) => it.description && it.amount_cents > 0)
    .slice(0, 20);
  if (!lineItems.length) return { ok: false, error: "Add at least one line." };

  const subtotalCents = lineItems.reduce((s, i) => s + i.amount_cents, 0);
  const discountKind = body.discountKind === "percent" || body.discountKind === "flat" ? body.discountKind : null;
  const rawDiscount = Math.round(Number(body.discountValue));
  const discountValue = discountKind && Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : null;
  const discountCents = !discountValue
    ? 0
    : discountKind === "percent"
      ? Math.min(subtotalCents, Math.round((subtotalCents * Math.min(100, discountValue)) / 100))
      : Math.min(subtotalCents, discountValue);
  const totalCents = subtotalCents - discountCents;
  if (totalCents < 50) return { ok: false, error: "After the discount, the total must be at least $0.50." };

  const valid = str(body.validUntil, 10);
  return {
    ok: true,
    quote: {
      customerEmail,
      customerName: str(body.customerName, 120),
      customerCompany: str(body.customerCompany, 120),
      title,
      scope: str(body.scope, 6000),
      validUntil: DAY_RE.test(valid) ? valid : null,
      requestId: typeof body.requestId === "string" && UUID_RE.test(body.requestId) ? body.requestId : null,
      projectId: typeof body.projectId === "string" && UUID_RE.test(body.projectId) ? body.projectId : null,
      lineItems,
      subtotalCents,
      discountKind: discountValue ? discountKind : null,
      discountValue,
      totalCents,
    },
  };
}

/** Still waiting on the client: sent, not answered, not past its date. */
export function quoteOpen(q: { status?: unknown; valid_until?: unknown }, today = new Date().toISOString().slice(0, 10)): boolean {
  if (q.status !== "sent") return false;
  const until = typeof q.valid_until === "string" ? q.valid_until.slice(0, 10) : null;
  return !until || until >= today;
}

/** The word each screen shows. */
export function quoteStatusWord(q: { status?: unknown; valid_until?: unknown }, today?: string): QuoteStatus | "expired" {
  const s = String(q.status ?? "draft") as QuoteStatus;
  if (s === "sent" && !quoteOpen(q, today)) return "expired";
  return s;
}

/** What a typed signature has to be before it counts. */
export function signatureOk(name: unknown): name is string {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 120;
}
