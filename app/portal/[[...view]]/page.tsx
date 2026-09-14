import type { Metadata } from "next";
import { PortalClient } from "../PortalClient";
import { resolveSection } from "../sections";

export const metadata: Metadata = {
  title: "Portal",
  description: "Track your GHL Video orders, delivery, and invoices.",
  robots: { index: false, follow: false },
};

/* Every portal section is a real URL (/portal/work/custom/, /portal/billing/,
 * /portal/settings/, ...), and a thing opens at its own path so a teammate
 * can be sent straight to it: /portal/work/custom/<id>/ is a project,
 * /portal/billing/<id>/ an order, /portal/library/<code>/ an item. The old
 * names (/portal/projects/, /portal/orders/, /portal/videos/) still open the
 * right screen. Unknown segments land on Home. */
export default async function PortalViewPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view } = await params;
  const r = resolveSection(view ?? []);
  return (
    <PortalClient
      initialView={r.section}
      initialLine={r.line}
      initialOrderId={r.section === "billing" ? r.id : null}
      initialItemCode={r.section === "library" ? r.id : null}
      initialProjectId={r.section === "work" && r.line === "custom" ? r.id : null}
    />
  );
}
