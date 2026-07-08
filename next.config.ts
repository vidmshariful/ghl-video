import type { NextConfig } from "next";

/*
 * Static export: the whole site is prerendered HTML/CSS/JS, which is the
 * most reliable shape for Cloudflare Pages. 301s from the old WordPress
 * URLs live in public/_redirects (Cloudflare Pages honors that file).
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
