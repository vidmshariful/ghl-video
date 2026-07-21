import "server-only";
import Stripe from "stripe";

/*
 * Server-only Stripe client. The secret key never reaches the browser;
 * the client side only ever sees the publishable key and the per-order
 * client_secret. apiVersion is omitted so the SDK uses the account's
 * pinned default, avoiding version drift between SDK and dashboard.
 */
let cached: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!cached) cached = new Stripe(key);
  return cached;
}
