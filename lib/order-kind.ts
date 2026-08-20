/*
 * What kind of one-time sale an order actually was.
 *
 * Three kinds, and the distinction that matters is the last two. An invoice
 * raised against an order we had ALREADY delivered is extra work on those
 * videos: a niche customisation, a re-cut, a language pass. It creates no new
 * videos and it is not a project. An invoice standing on its own is bespoke
 * work, and that is a project.
 *
 * Both used to be lumped together as "custom", which read a client who bought
 * a pack and paid for a tweak as a custom-video client. They are not: they are
 * a premade client who bought an extra, and the difference changes how you
 * talk to them.
 *
 * Import-free so both the customer routes and its tests can use it.
 */
import type { OrderKind } from "./customer-record";

export type InvoiceLink = {
  /** the product this invoice is billed through */
  productId: string | null;
  /** set when the invoice tops up an order that already exists */
  parentOrderId: string | null;
};

/**
 * `invoiceByProduct` maps a product id to the invoice billed through it.
 * An order whose product is not in that map was an ordinary purchase.
 */
export function orderKind(
  productId: string | null,
  productMetadata: { invoice?: unknown } | null,
  invoiceByProduct: Map<string, InvoiceLink>,
): OrderKind {
  const invoice = productId ? invoiceByProduct.get(productId) : undefined;
  if (invoice) return invoice.parentOrderId ? "addon" : "custom";
  /* an invoice-minted product with no invoice row left (a deleted invoice)
   * is still not a shelf purchase, so it reads as custom rather than premade */
  if (productMetadata?.invoice) return "custom";
  return "premade";
}
