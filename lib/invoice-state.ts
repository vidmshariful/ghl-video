/*
 * What an invoice row says about itself, in one place.
 *
 * Since phase 3 (September 2026) an invoice is raised and paid in HighLevel
 * and this table mirrors it. paid_at is the one test for paid. Before that,
 * eleven screens each asked "is there a paid order for the throwaway product
 * behind this invoice", and they did not always agree. Import-free so every
 * reader, the tests included, gets the same answer.
 */

export type InvoiceStateRow = {
  status?: unknown;
  paid_at?: unknown;
  hl_status?: unknown;
  hl_url?: unknown;
  hl_number?: unknown;
  number?: unknown;
  token?: unknown;
  product_sku?: unknown;
};

/** The money has arrived. */
export function invoiceSettled(row: InvoiceStateRow): boolean {
  return Boolean(row.paid_at);
}

export function invoiceVoided(row: InvoiceStateRow): boolean {
  return row.status === "void" || row.hl_status === "void";
}

/** Still owed: raised, not void, not paid. */
export function invoiceOpen(row: InvoiceStateRow): boolean {
  return !invoiceSettled(row) && !invoiceVoided(row);
}

/** The number the client knows: HighLevel's once it has one, ours before that. */
export function invoiceDisplayNumber(row: InvoiceStateRow): string {
  return String(row.hl_number || row.number || "");
}

/**
 * Where the client pays. HighLevel's page once the invoice is there; the
 * old checkout for a legacy invoice that still bills through a product.
 */
export function invoicePayUrl(row: InvoiceStateRow): string | null {
  if (!invoiceOpen(row)) return null;
  if (typeof row.hl_url === "string" && row.hl_url) return row.hl_url;
  if (typeof row.product_sku === "string" && row.product_sku) return `/checkout/${row.product_sku}/`;
  return null;
}

/** open, paid or void: the word every screen shows. */
export function invoiceStatusWord(row: InvoiceStateRow): "open" | "paid" | "void" {
  if (invoiceSettled(row)) return "paid";
  if (invoiceVoided(row)) return "void";
  return "open";
}
