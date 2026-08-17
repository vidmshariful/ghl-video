import type { Metadata } from "next";
import { PortalClient } from "../PortalClient";
import { PORTAL_SECTIONS, type PortalSection } from "../sections";

export const metadata: Metadata = {
  title: "Portal",
  description: "Track your GHL Video orders, delivery, and invoices.",
  robots: { index: false, follow: false },
};

/* Every portal section is a real URL (/portal/orders/, /portal/settings/,
 * ...), and an order opens at /portal/orders/<id>/ so a teammate can be
 * sent straight to a project. Unknown segments land on the dashboard. */
export default async function PortalViewPage({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view } = await params;
  const seg = view?.[0] ?? "dashboard";
  const initialView = (PORTAL_SECTIONS as readonly string[]).includes(seg)
    ? (seg as PortalSection)
    : "dashboard";
  const initialOrderId = initialView === "orders" && view?.[1] ? view[1] : null;
  /* /portal/library/<code>/ opens that video or pack directly, so one can be
   * sent to a cofounder as a plain link */
  const initialItemCode = initialView === "library" && view?.[1] ? view[1] : null;
  return (
    <PortalClient
      initialView={initialView}
      initialOrderId={initialOrderId}
      initialItemCode={initialItemCode}
    />
  );
}
