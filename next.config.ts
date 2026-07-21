import type { NextConfig } from "next";

/*
 * Server mode (Vercel). The marketing pages are still statically
 * generated at build time (nothing in them reads request-time APIs, and
 * the backend chrome fetch is force-cached), but the app now also ships
 * server route handlers, which the native checkout needs: the Stripe
 * PaymentIntent call, the Stripe webhook, and the HighLevel sync all run
 * server-side. A static export cannot host those.
 *
 * 301s from the old WordPress URLs live in vercel.json (Vercel honors it
 * in every mode). public/_redirects remains for any future Cloudflare
 * Pages target and is simply ignored on Vercel.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
