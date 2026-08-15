import type { Metadata } from "next";
import { PartnersClient } from "../PartnersClient";
import { PARTNER_VIEWS, type View } from "../views";

export const metadata: Metadata = {
  title: "Partner Portal",
  description: "Your GHL Video partner links, assets, and program details.",
  robots: { index: false, follow: false },
};

/* Every partner view is a real URL: /partners/earnings/, /partners/assets/,
 * ... Unknown segments land on the dashboard. The explicit routes
 * (/partners/apply, /partners/set-password) win over this catch-all. */
export default async function PartnersViewPage({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view } = await params;
  const seg = view?.[0] ?? "dashboard";
  const initial = (PARTNER_VIEWS as readonly string[]).includes(seg)
    ? (seg as View)
    : "dashboard";
  return <PartnersClient initialView={initial} />;
}
