import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

/* unique meta (was falling back to the homepage description) and
 * noindex until the page carries real resources */
export const metadata: Metadata = {
  title: "Free Resources",
  description:
    "Free video resources for HighLevel SaaS teams: guides, templates, and swipe files, added as they release.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/resources/" },
};

export default function Page() {
  return <StubPage title="Free Resources" note="Free resources for HighLevel teams land here as they are released." />;
}
