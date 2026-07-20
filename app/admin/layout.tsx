import type { Metadata } from "next";

/* The site's managing area. Lives outside the (site) route group on
 * purpose: no marketing header/footer, no tracking scripts, and never
 * indexed. Access control is real auth (Supabase) enforced by
 * row-level security, not a client-side password check. */
export const metadata: Metadata = {
  title: "Site Admin | GHL Video",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen w-full bg-canvas text-ink">{children}</div>;
}
