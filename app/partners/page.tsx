import type { Metadata } from "next";
import { PartnersClient } from "./PartnersClient";

export const metadata: Metadata = {
  title: "Partner Portal",
  description: "Your GHL Video partner links, assets, and program details.",
  robots: { index: false, follow: false },
};

export default function PartnersPage() {
  return <PartnersClient />;
}
