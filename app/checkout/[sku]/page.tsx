import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getActiveProductBySku } from "@/lib/checkout/products";
import { normalizeRef } from "@/lib/affiliates";
import { newCodeForOldSku } from "@/lib/catalog-db";
import { getApplicableBumps } from "@/lib/checkout/bumps";
import { CheckoutTrust } from "@/components/checkout/CheckoutTrust";
import { RuledBox } from "@/components/RuledBox";
import { clients, rating, deliveryWindow } from "@/lib/site";
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
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ code?: string | string[]; ref?: string | string[] }>;
}) {
  const { sku } = await params;
  const sp = await searchParams;
  /* campaign and partner links carry ?code=; the client auto-applies it and
     it is validated server-side on apply and again at charge time, so the
     URL can never change what is charged */
  const initialCouponCode = typeof sp.code === "string" ? sp.code.slice(0, 32) : null;
  /* partner links carry ?ref= for ATTRIBUTION only (the discount is the
     coupon). Falls back to the first-touch ghlv_ref cookie for a returning
     buyer; any well-formed ref credits, known partner or not. */
  const refParam = typeof sp.ref === "string" ? sp.ref : null;
  const ref =
    normalizeRef(refParam) ?? normalizeRef((await cookies()).get("ghlv_ref")?.value);
  const product = await getActiveProductBySku(sku);
  if (!product) {
    // a retired sku (renumbered or replaced) forwards to its current code so
    // old links, ads, and bookmarks keep working instead of 404ing
    const current = await newCodeForOldSku(sku);
    if (current) {
      const qs = new URLSearchParams();
      if (initialCouponCode) qs.set("code", initialCouponCode);
      if (ref) qs.set("ref", ref);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      redirect(`/checkout/${current}/${q}`);
    }
    notFound();
  }

  const isSub = product.type === "subscription";
  const meta = product.metadata ?? {};
  const isBundle = meta.kind === "pack" || meta.kind === "bundle";
  const code =
    meta.code ?? (product.type === "one_time" ? product.sku.toUpperCase() : null);

  // bumps only apply to one-time purchases
  const bumps = isSub ? [] : await getApplicableBumps(product);

  const included = isSub
    ? [
        `${meta.long_form} long-form edits per month`,
        `${meta.short_form} short-form edits per month`,
        "Unlimited revisions",
        "No contracts, cancel anytime",
        "Edited by a HighLevel-fluent team",
      ]
    : isBundle
      ? [
          meta.video_count
            ? `${meta.video_count} custom-branded videos`
            : "Every video in the bundle, custom-branded",
          "AI-first, white-label scripts written for HighLevel SaaS",
          "Professional voiceover included",
          meta.delivery_days
            ? `Delivered in about ${meta.delivery_days} business days`
            : "Fast delivery",
          "Full commercial rights",
        ]
      : [
          meta.format
            ? `One finished ${meta.format.toLowerCase()} video`
            : "One finished video",
          "AI-first, white-label script written for HighLevel SaaS",
          "Professional voiceover included",
          meta.delivery_days
            ? `Delivered in about ${meta.delivery_days} business days`
            : `Delivered in ${deliveryWindow}`,
          "Full commercial rights",
        ];

  /* the ref rides with a subscription purchase so the sale credits the
     partner (metadata + HighLevel tag); one-time attribution reads the
     cookie inside finalize. Discounts come only from the coupon. */
  const partnerRef = isSub ? ref : null;

  return (
    <>
      {/* the checkout box is one ruled cell-grid, drawn into the page like every
          other section: edge-to-edge top/bottom rules, narrow hatch gutters out
          to the frame rails (RuledBox), two solid canvas cells joined by a
          hairline. No floating cards, no oversized rails. */}
      <section
        id="checkout-box"
        className="relative scroll-mt-24 overflow-x-clip pt-12 pb-20 md:pt-16 md:pb-28"
      >
        <div className="shell">
          <header className="mb-10 text-center md:mb-12">
            <h1 className="font-display text-[30px] font-semibold uppercase leading-[1.1] tracking-[-0.01em] text-ink">
              Checkout
            </h1>
          </header>
          <RuledBox>
            <CheckoutClient
              sku={product.sku}
              code={code}
              name={product.name}
              description={product.description}
              priceCents={product.price_cents}
              currency={product.currency}
              type={product.type}
              included={included}
              bumps={bumps}
              rating={rating}
              clients={clients}
              initialCouponCode={initialCouponCode}
              partnerRef={partnerRef}
            />
          </RuledBox>
        </div>
      </section>

      <CheckoutTrust />
    </>
  );
}
