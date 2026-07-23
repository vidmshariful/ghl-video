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
/* Baseline security headers on every response. Deliberately NO Content-Security-
 * Policy yet: the site loads Stripe, the LeadConnector chat widget, Supabase, and
 * admin-managed inline snippets (site_settings scripts), so a CSP needs careful
 * per-source allowlisting and live testing before it can ship without breaking
 * checkout. These four are safe to add unconditionally. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
