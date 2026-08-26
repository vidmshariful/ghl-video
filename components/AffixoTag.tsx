import Script from "next/script";

/*
 * Affixo's click tracker.
 *
 * One job: when somebody arrives on a partner link, record the click and
 * drop a first-party `_sa_vid` cookie. Checkout reads that cookie at
 * finalize and stamps it on the PaymentIntent, which is how the Stripe
 * webhook, that never sees a browser, still knows whose click earned the
 * sale.
 *
 * Deliberately NOT in the root layout. That would load it on /admin and
 * /portal too, where there is no visitor to attribute and the only thing a
 * tracker can produce is noise in a partner's click count. It goes on the
 * three surfaces a buyer actually walks through: the marketing site, the
 * sales landing pages, and checkout.
 *
 * Renders nothing without the key, so a missing env var costs a no-op
 * rather than a script tag pointed at nowhere.
 */
export function AffixoTag() {
  const key = process.env.NEXT_PUBLIC_AFFIXO_KEY;
  if (!key) return null;
  return (
    <Script
      src={`https://go.affixo.dev/sa.js?w=${encodeURIComponent(key)}`}
      strategy="afterInteractive"
    />
  );
}
