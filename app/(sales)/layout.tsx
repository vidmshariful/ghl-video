import type { Metadata } from "next";
import "./sales.css";

/*
 * Sales landing pages: their own route group with NONE of the marketing
 * chrome (no header, footer, page-frame grid, or scroll ruler) and their
 * own scoped design system (sales.css, everything under .sp). Outreach
 * only, so noindex. The root layout still supplies <html>, the brand
 * fonts, and the CSS reset.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <div className="sp">{children}</div>;
}
