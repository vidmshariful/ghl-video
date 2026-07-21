import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { CheckoutClient } from "./CheckoutClient";

/* Always server-rendered: reads the product (and its authoritative price)
 * per request, and checkout should never be cached or indexed. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = await getActiveProductBySku(sku);
  if (!product) notFound();

  const isSub = product.type === "subscription";
  const money = (product.price_cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency.toUpperCase(),
    minimumFractionDigits: 0,
  });
  const priceDisplay = isSub ? `${money}/mo` : money;

  const meta = product.metadata ?? {};
  const included = isSub
    ? [
        `${meta.long_form} long-form edits per month`,
        `${meta.short_form} short-form edits per month`,
        "Unlimited revisions",
        "No contracts, cancel anytime",
        "Edited by a HighLevel-fluent team",
      ]
    : [
        meta.format ? `${meta.format}, 90 to 120 seconds` : "One finished video",
        "AI-first, white-label script written for HighLevel SaaS",
        "Broadcast-quality animation, voiceover, and sound",
        meta.delivery_days
          ? `Delivered in about ${meta.delivery_days} business days`
          : "Fast delivery",
        "Yours to use across your whole funnel",
      ];

  return (
    <section className="relative section-pad">
      <div className="shell">
        <div className="mb-10 max-w-[46rem]">
          <p className="font-mono text-label uppercase text-gold">[ Checkout ]</p>
          <h1 className="mt-4 font-display text-h1 leading-[1.02] text-ink">
            {product.name}
          </h1>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
          {/* order summary */}
          <aside className="rounded-card border border-hair bg-card p-7 md:p-9 lg:sticky lg:top-24">
            <p className="font-mono text-label uppercase text-muted">
              [ Order summary ]
            </p>
            <div className="mt-5 flex items-baseline justify-between border-b border-hair pb-5">
              <span className="max-w-[22ch] font-display text-h4 text-ink">
                {product.name}
              </span>
              <span className="font-display text-price text-gold">{priceDisplay}</span>
            </div>
            {product.description ? (
              <p className="mt-5 text-body text-muted">{product.description}</p>
            ) : null}
            <ul className="mt-6 grid gap-3">
              {included.map((line) => (
                <li key={line} className="flex gap-3 text-body-sm text-muted">
                  <span aria-hidden="true" className="mt-[2px] text-gold">
                    &#10003;
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex items-baseline justify-between border-t border-hair pt-5">
              <span className="font-mono text-label uppercase text-muted">
                {isSub ? "Due today" : "Total due today"}
              </span>
              <span className="font-display text-price text-ink">{priceDisplay}</span>
            </div>
            <p className="mt-3 text-body-sm text-dim">
              {isSub ? "Billed monthly. Cancel anytime." : "One-time payment. No subscription."}
            </p>
          </aside>

          {/* details + payment */}
          <div className="rounded-card border border-hair bg-surface p-7 md:p-9">
            <CheckoutClient sku={product.sku} priceLabel={priceDisplay} type={product.type} />
          </div>
        </div>
      </div>
    </section>
  );
}
