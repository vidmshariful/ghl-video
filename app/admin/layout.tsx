import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/components/portal/theme-init";

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
  return (
    <div data-surface="portal" className="min-h-screen w-full bg-canvas text-ink">
      {/* saved light/dark applied before paint; see components/portal/theme-init */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {children}
    </div>
  );
}
