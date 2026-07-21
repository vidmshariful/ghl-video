import type { Metadata } from "next";

/* The client portal. Like /admin, it lives outside the (site) route group
 * on purpose: no marketing header/footer, no chrome, never indexed. A
 * signed-in client sees only their portal, not the website. */
export const metadata: Metadata = {
  title: "Portal | GHL Video",
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen w-full bg-canvas text-ink">{children}</div>;
}
