import "server-only";

/*
 * One reading of an invoice form, shared by create and edit.
 *
 * This exists because there are now two ways to write the same invoice, and
 * two places computing a total is exactly how a client ends up owing a
 * different number than the bill says. Every rule about what an invoice may
 * contain lives here: what a line is worth, how a discount lands, what the
 * floor is. The routes decide who may call it. They do not decide what the
 * money is.
 *
 * Money is integer cents throughout, as everywhere else in this codebase.
 */

export const INVOICE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* amount_cents is the LINE TOTAL, always. quantity and unit_cents are
   optional detail, so every screen that already renders invoices keeps
   working without knowing they exist. */
export type InvoiceLineItem = {
  description: string;
  amount_cents: number;
  quantity?: number;
  unit_cents?: number;
};

export type ParsedInvoice = {
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  notes: string;
  dueDate: string | null;
  projectIds: string[];
  projectId: string | null;
  parentOrderId: string | null;
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  discountKind: "percent" | "flat" | null;
  discountValue: number | null;
  totalCents: number;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Normalize and validate an invoice form body.
 *
 * Returns the parsed invoice or a single message fit to show the person
 * filling the form in. Never throws, and never trusts a total the client
 * sent: every figure here is re-derived from the lines.
 */
export function parseInvoiceInput(
  body: Record<string, unknown>,
): { ok: true; invoice: ParsedInvoice } | { ok: false; error: string } {
  const customerEmail = str(body.customerEmail, 254).toLowerCase();
  if (!customerEmail || !INVOICE_EMAIL_RE.test(customerEmail)) {
    return { ok: false, error: "A valid client email is required." };
  }

  const projectIds = (Array.isArray(body.projectIds) ? body.projectIds : [])
    .filter((v): v is string => typeof v === "string" && UUID_RE.test(v))
    .slice(0, 20);
  /* the first job stays in project_id, so everything that already reads one
     job per invoice keeps reading the right one */
  const projectId =
    projectIds[0] ??
    (typeof body.projectId === "string" && UUID_RE.test(body.projectId) ? body.projectId : null);

  const lineItems: InvoiceLineItem[] = (Array.isArray(body.lineItems) ? body.lineItems : [])
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
  if (lineItems.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }

  const subtotalCents = lineItems.reduce((s, i) => s + i.amount_cents, 0);

  /* a discount is either a percentage of the lines or a flat amount off,
     and it can never carry a bill below nothing */
  const discountKind =
    body.discountKind === "percent" || body.discountKind === "flat" ? body.discountKind : null;
  const rawDiscount = Math.round(Number(body.discountValue));
  const discountValue =
    discountKind && Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : null;
  const discountCents = !discountValue
    ? 0
    : discountKind === "percent"
      ? Math.min(subtotalCents, Math.round((subtotalCents * Math.min(100, discountValue)) / 100))
      : Math.min(subtotalCents, discountValue);
  const totalCents = subtotalCents - discountCents;

  if (totalCents < 50) {
    return { ok: false, error: "After the discount, the total must be at least $0.50." };
  }

  const due = str(body.dueDate, 10);

  return {
    ok: true,
    invoice: {
      customerName: str(body.customerName, 120),
      customerEmail,
      customerCompany: str(body.customerCompany, 120),
      /* the paragraph the client reads under the lines: what else is included,
         what was agreed, anything the line descriptions cannot carry */
      notes: str(body.notes, 4000),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
      projectIds,
      projectId,
      parentOrderId:
        typeof body.parentOrderId === "string" && UUID_RE.test(body.parentOrderId)
          ? body.parentOrderId
          : null,
      lineItems,
      subtotalCents,
      discountKind,
      discountValue,
      totalCents,
    },
  };
}
